mod planning;

use std::collections::HashMap;

use rusqlite::Connection;
use serde_json::{json, Value};

use crate::db::DbError;
use crate::integrations::jira::JiraClient;
use crate::models::{
    JiraCreateAllowedValue, JiraCreateFieldMetadata, JiraCreateIssueResponse,
    JiraCreateIssuesResult, JiraCreateMetadata, JiraCreateProgress, JiraCreatedIssueResult,
    JiraFailedTaskResult, JiraMyself, JqlSearchResponse, LocalTask,
};
use crate::repositories::{SyncRepository, TaskRepository, TrayRepository};
use crate::sync_audit::{audit_error_detail, audit_error_message, audit_error_messages_detail};

use planning::{
    issue_type_name_matches, EpicLinkStyle, IssueTypePlan, IssueTypeRole, JiraCreationPlan,
    JiraCreationPlanningOptions, JiraCreationTaskScope,
};

const JIRA_TASK_FORGE_LABEL: &str = "jira-task-forge";
const JIRA_TASK_FORGE_PROPERTY_KEY: &str = "jira-task-forge-sync";
const JIRA_PROVIDER_OPERATION: &str = "create-parent-issues";

pub trait JiraIssueGateway {
    fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String>;
    fn current_user(&mut self) -> Result<JiraMyself, String>;
    fn search_jql(&mut self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String>;
    fn create_issue(&mut self, payload: Value) -> Result<JiraCreateIssueResponse, String>;
    fn update_issue_fields(&mut self, key: &str, payload: Value) -> Result<(), String>;
    fn issue_browse_url(&self, key: &str) -> String;
}

impl JiraIssueGateway for JiraClient {
    fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String> {
        self.get_create_issue_metadata(project_key)
    }

    fn current_user(&mut self) -> Result<JiraMyself, String> {
        self.get_myself()
    }

    fn search_jql(&mut self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String> {
        JiraClient::search_jql(self, jql, max_results)
    }

    fn create_issue(&mut self, payload: Value) -> Result<JiraCreateIssueResponse, String> {
        JiraClient::create_issue(self, payload)
    }

    fn update_issue_fields(&mut self, key: &str, payload: Value) -> Result<(), String> {
        JiraClient::update_issue_fields(self, key, payload)
    }

    fn issue_browse_url(&self, key: &str) -> String {
        JiraClient::issue_browse_url(self, key)
    }
}

pub struct JiraSyncRunner<'connection, 'gateway, Gateway>
where
    Gateway: JiraIssueGateway,
{
    connection: &'connection Connection,
    gateway: &'gateway mut Gateway,
    creation_project_key: String,
}

impl<'connection, 'gateway, Gateway> JiraSyncRunner<'connection, 'gateway, Gateway>
where
    Gateway: JiraIssueGateway,
{
    pub fn new(
        connection: &'connection Connection,
        gateway: &'gateway mut Gateway,
        creation_project_key: String,
    ) -> Self {
        Self {
            connection,
            gateway,
            creation_project_key: creation_project_key.trim().to_ascii_uppercase(),
        }
    }

    pub fn create_parent_issues_from_tray(
        &mut self,
        tray_id: &str,
        allow_missing_descriptions: bool,
    ) -> Result<JiraCreateIssuesResult, String> {
        self.create_parent_issues_from_tray_with_progress(
            tray_id,
            allow_missing_descriptions,
            true,
            |_| {},
        )
    }

    pub fn create_parent_issues_from_tray_with_progress<F>(
        &mut self,
        tray_id: &str,
        allow_missing_descriptions: bool,
        include_exported_tasks: bool,
        mut report_progress: F,
    ) -> Result<JiraCreateIssuesResult, String>
    where
        F: FnMut(JiraCreateProgress),
    {
        let tray = TrayRepository::new(self.connection)
            .find_by_id(tray_id)
            .map_err(db_error_message)?
            .ok_or_else(|| "Tray not found.".to_string())?;
        let tasks = TaskRepository::new(self.connection)
            .list_for_tray(tray_id)
            .map_err(db_error_message)?;
        let sync_repository = SyncRepository::new(self.connection);
        let sync_attempt_id = sync_repository
            .start_attempt(tray_id, "create-in-jira")
            .map_err(db_error_message)?;
        let mut completed_steps = 0;
        let mut total_steps = 1;
        let mut result = JiraCreateIssuesResult {
            sync_attempt_id: sync_attempt_id.clone(),
            status: "running".to_string(),
            created_issue_count: 0,
            skipped_issue_count: 0,
            failed_issue_count: 0,
            created_issues: Vec::new(),
            failed_tasks: Vec::new(),
            messages: Vec::new(),
        };
        report_jira_create_progress(
            &mut report_progress,
            Some(&sync_attempt_id),
            "starting",
            "Starting Jira creation",
            Some(&tray.name),
            completed_steps,
            total_steps,
            "running",
        );

        sync_repository
            .record_event(
                &sync_attempt_id,
                tray_id,
                None,
                "jira.sync.started",
                "succeeded",
                JIRA_PROVIDER_OPERATION,
                json!({
                    "trayId": tray.id,
                    "trayName": tray.name,
                    "jiraProjectKey": self.creation_project_key,
                    "includeExportedTasks": include_exported_tasks,
                }),
            )
            .map_err(db_error_message)?;

        let task_scope = JiraCreationTaskScope::from_tasks(
            &tasks,
            JiraCreationPlanningOptions {
                creation_project_key: &self.creation_project_key,
                allow_missing_descriptions,
                include_exported_tasks,
            },
        );
        let createable_task_count = task_scope.createable_task_count;
        result.skipped_issue_count = task_scope.skipped_issue_count;
        total_steps = task_scope.progress_total_steps;
        report_jira_create_progress(
            &mut report_progress,
            Some(&sync_attempt_id),
            "validating",
            "Validating local tasks",
            Some(&format!(
                "{} createable {}",
                createable_task_count,
                if createable_task_count == 1 {
                    "Jira issue"
                } else {
                    "Jira issues"
                }
            )),
            completed_steps,
            total_steps,
            "running",
        );

        if !task_scope.local_blockers.is_empty() {
            report_jira_create_progress(
                &mut report_progress,
                Some(&sync_attempt_id),
                "blocked",
                "Jira creation blocked",
                task_scope.local_blockers.first().map(String::as_str),
                completed_steps,
                total_steps,
                "failed",
            );
            return self.finish_blocked(
                sync_repository,
                &sync_attempt_id,
                tray_id,
                task_scope.local_blockers,
                result,
            );
        }
        completed_steps += 1;

        report_jira_create_progress(
            &mut report_progress,
            Some(&sync_attempt_id),
            "metadata",
            "Reading Jira create metadata",
            Some(&self.creation_project_key),
            completed_steps,
            total_steps,
            "running",
        );
        let metadata = match self.gateway.create_metadata(&self.creation_project_key) {
            Ok(metadata) => metadata,
            Err(message) => {
                report_jira_create_progress(
                    &mut report_progress,
                    Some(&sync_attempt_id),
                    "metadata",
                    "Could not read Jira metadata",
                    Some(&message),
                    completed_steps,
                    total_steps,
                    "failed",
                );
                return self.finish_blocked(
                    sync_repository,
                    &sync_attempt_id,
                    tray_id,
                    vec![format!("Could not read Jira create metadata: {message}")],
                    result,
                );
            }
        };
        completed_steps += 1;
        let plan = match task_scope.with_metadata(&metadata) {
            Ok(plan) => plan,
            Err(messages) => {
                report_jira_create_progress(
                    &mut report_progress,
                    Some(&sync_attempt_id),
                    "metadata",
                    "Jira metadata cannot create these tasks",
                    messages.first().map(String::as_str),
                    completed_steps,
                    total_steps,
                    "failed",
                );
                return self.finish_blocked(
                    sync_repository,
                    &sync_attempt_id,
                    tray_id,
                    messages,
                    result,
                );
            }
        };
        if !plan.missing_description_blockers.is_empty() {
            report_jira_create_progress(
                &mut report_progress,
                Some(&sync_attempt_id),
                "metadata",
                "Jira metadata requires descriptions",
                plan.missing_description_blockers
                    .first()
                    .map(String::as_str),
                completed_steps,
                total_steps,
                "failed",
            );
            return self.finish_blocked(
                sync_repository,
                &sync_attempt_id,
                tray_id,
                plan.missing_description_blockers,
                result,
            );
        }

        sync_repository
            .record_event(
                &sync_attempt_id,
                tray_id,
                None,
                "jira.metadata.preflight",
                "succeeded",
                JIRA_PROVIDER_OPERATION,
                json!({
                    "jiraProjectKey": self.creation_project_key,
                    "issueTypes": plan.issue_type_names(),
                    "taskCount": createable_task_count,
                }),
            )
            .map_err(db_error_message)?;

        report_jira_create_progress(
            &mut report_progress,
            Some(&sync_attempt_id),
            "account",
            if plan.requires_reporter() {
                "Reading Jira account"
            } else {
                "Preparing Jira creation plan"
            },
            Some("Checking required Jira fields"),
            completed_steps,
            total_steps,
            "running",
        );
        let reporter_account_id = if plan.requires_reporter() {
            match self.gateway.current_user() {
                Ok(user) => match user.account_id {
                    Some(account_id) if !account_id.trim().is_empty() => Some(account_id),
                    _ => {
                        report_jira_create_progress(
                            &mut report_progress,
                            Some(&sync_attempt_id),
                            "account",
                            "Could not resolve Jira reporter",
                            Some("The current Jira account id was empty."),
                            completed_steps,
                            total_steps,
                            "failed",
                        );
                        return self.finish_blocked(
                            sync_repository,
                            &sync_attempt_id,
                            tray_id,
                            vec![
                                "Jira create metadata requires Reporter, but the current Jira account id could not be resolved."
                                    .to_string(),
                            ],
                            result,
                        );
                    }
                },
                Err(message) => {
                    report_jira_create_progress(
                        &mut report_progress,
                        Some(&sync_attempt_id),
                        "account",
                        "Could not read Jira account",
                        Some(&message),
                        completed_steps,
                        total_steps,
                        "failed",
                    );
                    return self.finish_blocked(
                        sync_repository,
                        &sync_attempt_id,
                        tray_id,
                        vec![format!(
                            "Jira create metadata requires Reporter, but the current Jira user could not be read: {message}"
                        )],
                        result,
                    );
                }
            }
        } else {
            None
        };
        completed_steps += 1;

        let mut had_non_blocking_warning = false;
        let mut parent_jira_keys = tasks
            .iter()
            .filter_map(|task| {
                task.jira_key
                    .as_ref()
                    .filter(|key| !key.trim().is_empty())
                    .map(|key| (task.id.clone(), key.clone()))
            })
            .collect::<HashMap<_, _>>();
        for ((local_project, area), group_tasks) in &plan.project_area_groups {
            let epic_summary = format!("[{local_project}] {area}");
            report_jira_create_progress(
                &mut report_progress,
                Some(&sync_attempt_id),
                "epic",
                "Resolving Jira epic",
                Some(&epic_summary),
                completed_steps,
                total_steps,
                "running",
            );
            let epic_key = match resolve_or_create_epic(
                self.gateway,
                &sync_repository,
                &sync_attempt_id,
                tray_id,
                &plan,
                &self.creation_project_key,
                local_project,
                area,
                &epic_summary,
                reporter_account_id.as_deref(),
            ) {
                Ok(key) => {
                    completed_steps += 1;
                    report_jira_create_progress(
                        &mut report_progress,
                        Some(&sync_attempt_id),
                        "epic",
                        "Jira epic ready",
                        Some(&format!("{epic_summary} -> {key}")),
                        completed_steps,
                        total_steps,
                        "running",
                    );
                    key
                }
                Err(message) => {
                    completed_steps += 1;
                    report_jira_create_progress(
                        &mut report_progress,
                        Some(&sync_attempt_id),
                        "epic",
                        "Could not resolve Jira epic",
                        Some(&message),
                        completed_steps,
                        total_steps,
                        "running",
                    );
                    for task in group_tasks {
                        record_task_failure(
                            self.connection,
                            &sync_repository,
                            &sync_attempt_id,
                            tray_id,
                            &task,
                            &message,
                            &mut result,
                            "jira.epic.resolve",
                        )?;
                        completed_steps += 1;
                    }
                    continue;
                }
            };

            for task in group_tasks {
                report_jira_create_progress(
                    &mut report_progress,
                    Some(&sync_attempt_id),
                    "issue",
                    "Creating Jira issue",
                    Some(&jira_parent_summary(&task)),
                    completed_steps,
                    total_steps,
                    "running",
                );
                if let Some(existing_key) = task.jira_key.as_deref().filter(|key| !key.is_empty()) {
                    let existing_url = task
                        .jira_url
                        .clone()
                        .unwrap_or_else(|| self.gateway.issue_browse_url(existing_key));
                    TaskRepository::new(self.connection)
                        .mark_jira_created(&task.id, existing_key, &existing_url, &epic_key)
                        .map_err(db_error_message)?;
                    result.skipped_issue_count += 1;
                    result.messages.push(format!(
                        "{} already had Jira key {existing_key}; local status was repaired.",
                        task.title
                    ));
                    parent_jira_keys.insert(task.id.clone(), existing_key.to_string());
                    completed_steps += 1;
                    continue;
                }

                let issue_type = plan
                    .issue_type_for_local(&task.issue_type)
                    .expect("metadata plan should include validated parent issue type");
                let payload = build_parent_issue_payload(
                    issue_type,
                    &self.creation_project_key,
                    &task,
                    &epic_key,
                    &sync_attempt_id,
                    reporter_account_id.as_deref(),
                );

                match self.gateway.create_issue(payload) {
                    Ok(created_issue) => {
                        let created_key = created_issue.key.clone();
                        let issue_url = self.gateway.issue_browse_url(&created_issue.key);
                        TaskRepository::new(self.connection)
                            .mark_jira_created(&task.id, &created_issue.key, &issue_url, &epic_key)
                            .map_err(db_error_message)?;
                        sync_repository
                            .record_event(
                                &sync_attempt_id,
                                tray_id,
                                Some(&task.id),
                                "jira.issue.created",
                                "succeeded",
                                JIRA_PROVIDER_OPERATION,
                                json!({
                                    "jiraKey": created_issue.key,
                                    "epicKey": epic_key,
                                    "issueType": task.issue_type,
                                }),
                            )
                            .map_err(db_error_message)?;
                        if issue_type.field("priority").is_none() {
                            match update_issue_priority_after_create(
                                self.gateway,
                                &sync_repository,
                                &sync_attempt_id,
                                tray_id,
                                &task,
                                &created_issue.key,
                            ) {
                                Ok(()) => {}
                                Err(message) => {
                                    had_non_blocking_warning = true;
                                    result.messages.push(format!(
                                        "{} was created, but priority could not be set to {}: {}",
                                        created_issue.key, task.priority, message
                                    ));
                                }
                            }
                        }
                        result.created_issue_count += 1;
                        result.created_issues.push(JiraCreatedIssueResult {
                            task_id: Some(task.id.clone()),
                            key: created_issue.key,
                            url: issue_url,
                            issue_type: task.issue_type.clone(),
                            summary: jira_parent_summary(&task),
                            epic_key: Some(epic_key.clone()),
                        });
                        parent_jira_keys.insert(task.id.clone(), created_key);
                        completed_steps += 1;
                    }
                    Err(message) => {
                        record_task_failure(
                            self.connection,
                            &sync_repository,
                            &sync_attempt_id,
                            tray_id,
                            &task,
                            &message,
                            &mut result,
                            "jira.issue.create",
                        )?;
                        completed_steps += 1;
                    }
                }
            }
        }

        if let Some(subtask_issue_type) = plan.issue_types.subtask.as_ref() {
            for subtask in &plan.subtask_tasks {
                report_jira_create_progress(
                    &mut report_progress,
                    Some(&sync_attempt_id),
                    "subtask",
                    "Creating Jira sub-task",
                    Some(&subtask.title),
                    completed_steps,
                    total_steps,
                    "running",
                );

                let Some(parent_task_id) = subtask.parent_task_id.as_deref() else {
                    record_task_failure(
                        self.connection,
                        &sync_repository,
                        &sync_attempt_id,
                        tray_id,
                        &subtask,
                        "Sub-task is missing a parent local task.",
                        &mut result,
                        "jira.subtask.parent_missing",
                    )?;
                    completed_steps += 1;
                    continue;
                };
                let Some(parent_jira_key) = parent_jira_keys.get(parent_task_id) else {
                    record_task_failure(
                        self.connection,
                        &sync_repository,
                        &sync_attempt_id,
                        tray_id,
                        &subtask,
                        "Sub-task parent has no Jira key yet.",
                        &mut result,
                        "jira.subtask.parent_missing",
                    )?;
                    completed_steps += 1;
                    continue;
                };

                if let Some(existing_key) =
                    subtask.jira_key.as_deref().filter(|key| !key.is_empty())
                {
                    let existing_url = subtask
                        .jira_url
                        .clone()
                        .unwrap_or_else(|| self.gateway.issue_browse_url(existing_key));
                    TaskRepository::new(self.connection)
                        .mark_jira_subtask_created(&subtask.id, existing_key, &existing_url)
                        .map_err(db_error_message)?;
                    result.skipped_issue_count += 1;
                    result.messages.push(format!(
                        "{} already had Jira key {existing_key}; local sub-task status was repaired.",
                        subtask.title
                    ));
                    completed_steps += 1;
                    continue;
                }

                let payload = build_subtask_issue_payload(
                    subtask_issue_type,
                    &self.creation_project_key,
                    &subtask,
                    parent_jira_key,
                    &sync_attempt_id,
                    reporter_account_id.as_deref(),
                );

                match self.gateway.create_issue(payload) {
                    Ok(created_issue) => {
                        let issue_url = self.gateway.issue_browse_url(&created_issue.key);
                        TaskRepository::new(self.connection)
                            .mark_jira_subtask_created(&subtask.id, &created_issue.key, &issue_url)
                            .map_err(db_error_message)?;
                        sync_repository
                            .record_event(
                                &sync_attempt_id,
                                tray_id,
                                Some(&subtask.id),
                                "jira.subtask.created",
                                "succeeded",
                                JIRA_PROVIDER_OPERATION,
                                json!({
                                    "jiraKey": created_issue.key,
                                    "parentJiraKey": parent_jira_key,
                                    "issueType": subtask.issue_type,
                                }),
                            )
                            .map_err(db_error_message)?;
                        result.created_issue_count += 1;
                        result.created_issues.push(JiraCreatedIssueResult {
                            task_id: Some(subtask.id.clone()),
                            key: created_issue.key,
                            url: issue_url,
                            issue_type: subtask.issue_type.clone(),
                            summary: jira_subtask_summary(&subtask),
                            epic_key: None,
                        });
                        completed_steps += 1;
                    }
                    Err(message) => {
                        record_task_failure(
                            self.connection,
                            &sync_repository,
                            &sync_attempt_id,
                            tray_id,
                            &subtask,
                            &message,
                            &mut result,
                            "jira.subtask.create",
                        )?;
                        completed_steps += 1;
                    }
                }
            }
        }

        report_jira_create_progress(
            &mut report_progress,
            Some(&sync_attempt_id),
            "finalizing",
            "Finalizing Jira creation",
            None,
            completed_steps,
            total_steps,
            "running",
        );
        let final_status = if result.failed_issue_count == 0 && !had_non_blocking_warning {
            "succeeded"
        } else if result.created_issue_count == 0 {
            "failed"
        } else {
            "partial"
        };
        result.status = final_status.to_string();
        if result.created_issue_count > 0 {
            result.messages.push(format!(
                "{} Jira {} created.",
                result.created_issue_count,
                if result.created_issue_count == 1 {
                    "issue"
                } else {
                    "issues"
                }
            ));
        }
        if result.failed_issue_count > 0 {
            result.messages.push(format!(
                "{} local {} need recovery before retry.",
                result.failed_issue_count,
                if result.failed_issue_count == 1 {
                    "task"
                } else {
                    "tasks"
                }
            ));
        }

        sync_repository
            .finish_attempt(&sync_attempt_id, final_status)
            .map_err(db_error_message)?;
        completed_steps = total_steps;
        report_jira_create_progress(
            &mut report_progress,
            Some(&sync_attempt_id),
            "complete",
            "Jira creation finished",
            Some(&format!(
                "{} created, {} failed, {} skipped",
                result.created_issue_count, result.failed_issue_count, result.skipped_issue_count
            )),
            completed_steps,
            total_steps,
            final_status,
        );
        Ok(result)
    }

    fn finish_blocked(
        &self,
        sync_repository: SyncRepository<'_>,
        sync_attempt_id: &str,
        tray_id: &str,
        messages: Vec<String>,
        mut result: JiraCreateIssuesResult,
    ) -> Result<JiraCreateIssuesResult, String> {
        result.status = "blocked".to_string();
        result.messages = messages;
        sync_repository
            .record_event(
                sync_attempt_id,
                tray_id,
                None,
                "jira.sync.blocked",
                "failed",
                JIRA_PROVIDER_OPERATION,
                audit_error_messages_detail(&result.messages),
            )
            .map_err(db_error_message)?;
        sync_repository
            .finish_attempt(sync_attempt_id, "failed")
            .map_err(db_error_message)?;
        Ok(result)
    }
}

fn resolve_or_create_epic<Gateway>(
    gateway: &mut Gateway,
    sync_repository: &SyncRepository<'_>,
    sync_attempt_id: &str,
    tray_id: &str,
    plan: &JiraCreationPlan,
    jira_project_key: &str,
    local_project: &str,
    area: &str,
    epic_summary: &str,
    reporter_account_id: Option<&str>,
) -> Result<String, String>
where
    Gateway: JiraIssueGateway,
{
    let jql = format!(
        "project = {} AND summary ~ \"{}\" ORDER BY created DESC",
        escape_jql_identifier(jira_project_key),
        escape_jql_string(epic_summary)
    );
    let search_response = gateway.search_jql(&jql, 20)?;
    if let Some(existing_epic) = search_response.results.into_iter().find(|issue| {
        issue.summary == epic_summary
            && issue_type_name_matches(&issue.issue_type, IssueTypeRole::Epic)
    }) {
        sync_repository
            .record_event(
                sync_attempt_id,
                tray_id,
                None,
                "jira.epic.resolved",
                "succeeded",
                JIRA_PROVIDER_OPERATION,
                json!({
                    "jiraKey": existing_epic.key,
                    "summary": epic_summary,
                    "source": "search",
                }),
            )
            .map_err(db_error_message)?;
        return Ok(existing_epic.key);
    }

    let payload = build_epic_payload(
        plan,
        jira_project_key,
        local_project,
        area,
        epic_summary,
        sync_attempt_id,
        reporter_account_id,
    );
    let created_epic = gateway.create_issue(payload)?;
    sync_repository
        .record_event(
            sync_attempt_id,
            tray_id,
            None,
            "jira.epic.created",
            "succeeded",
            JIRA_PROVIDER_OPERATION,
            json!({
                "jiraKey": created_epic.key,
                "summary": epic_summary,
            }),
        )
        .map_err(db_error_message)?;
    Ok(created_epic.key)
}

fn build_epic_payload(
    plan: &JiraCreationPlan,
    jira_project_key: &str,
    local_project: &str,
    area: &str,
    summary: &str,
    sync_attempt_id: &str,
    reporter_account_id: Option<&str>,
) -> Value {
    let mut fields = json!({
        "project": { "key": jira_project_key },
        "issuetype": { "id": plan.issue_types.epic.id },
        "summary": summary,
        "labels": labels_for(local_project, area),
    });
    if plan.issue_types.epic.field("priority").is_some() {
        fields["priority"] = priority_value(plan.issue_types.epic.field("priority"), "Medium");
    }
    if let Some(account_id) = reporter_account_id {
        fields["reporter"] = json!({ "accountId": account_id });
    }
    if let Some(epic_name_field) = &plan.issue_types.epic.epic_name_field {
        fields[epic_name_field] = json!(summary);
    }

    json!({
        "fields": fields,
        "properties": [{
            "key": JIRA_TASK_FORGE_PROPERTY_KEY,
            "value": {
                "source": "jira-task-forge",
                "syncAttemptId": sync_attempt_id,
                "localProject": local_project,
                "area": area,
                "kind": "epic"
            }
        }]
    })
}

fn build_parent_issue_payload(
    issue_type: &IssueTypePlan,
    jira_project_key: &str,
    task: &LocalTask,
    epic_key: &str,
    sync_attempt_id: &str,
    reporter_account_id: Option<&str>,
) -> Value {
    let mut fields = json!({
        "project": { "key": jira_project_key },
        "issuetype": { "id": issue_type.id },
        "summary": jira_parent_summary(task),
        "labels": labels_for(&task.project, &task.area),
    });
    if issue_type.field("priority").is_some() {
        fields["priority"] = priority_value(issue_type.field("priority"), &task.priority);
    }
    if let Some(account_id) = reporter_account_id {
        fields["reporter"] = json!({ "accountId": account_id });
    }
    if let Some(description) = task
        .description
        .as_deref()
        .map(str::trim)
        .filter(|description| !description.is_empty())
        .filter(|_| issue_type.field("description").is_some())
    {
        fields["description"] = jira_description_document(description);
    }

    if let Some(epic_link_field) = &issue_type.epic_link_field {
        fields[&epic_link_field.key] = match epic_link_field.style {
            EpicLinkStyle::Parent => json!({ "key": epic_key }),
            EpicLinkStyle::EpicLink => json!(epic_key),
        };
    }

    json!({
        "fields": fields,
        "properties": [{
            "key": JIRA_TASK_FORGE_PROPERTY_KEY,
            "value": {
                "source": "jira-task-forge",
                "syncAttemptId": sync_attempt_id,
                "localTaskId": task.id,
                "localProject": task.project,
                "area": task.area,
                "kind": "parent"
            }
        }]
    })
}

fn build_subtask_issue_payload(
    issue_type: &IssueTypePlan,
    jira_project_key: &str,
    task: &LocalTask,
    parent_jira_key: &str,
    sync_attempt_id: &str,
    reporter_account_id: Option<&str>,
) -> Value {
    let mut fields = json!({
        "project": { "key": jira_project_key },
        "issuetype": { "id": issue_type.id },
        "summary": jira_subtask_summary(task),
        "parent": { "key": parent_jira_key },
        "labels": labels_for(&task.project, &task.area),
    });
    if issue_type.field("priority").is_some() {
        fields["priority"] = priority_value(issue_type.field("priority"), &task.priority);
    }
    if let Some(account_id) = reporter_account_id {
        fields["reporter"] = json!({ "accountId": account_id });
    }

    json!({
        "fields": fields,
        "properties": [{
            "key": JIRA_TASK_FORGE_PROPERTY_KEY,
            "value": {
                "source": "jira-task-forge",
                "syncAttemptId": sync_attempt_id,
                "localTaskId": task.id,
                "parentLocalTaskId": task.parent_task_id.as_deref(),
                "localProject": task.project,
                "area": task.area,
                "kind": "subtask"
            }
        }]
    })
}

fn jira_description_document(markdown: &str) -> Value {
    let mut content = Vec::new();
    for line in markdown
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        let node = if let Some(text) = line.strip_prefix("### ") {
            json!({
                "type": "heading",
                "attrs": { "level": 3 },
                "content": [{ "type": "text", "text": text }]
            })
        } else if let Some(text) = line.strip_prefix("## ") {
            json!({
                "type": "heading",
                "attrs": { "level": 2 },
                "content": [{ "type": "text", "text": text }]
            })
        } else {
            json!({
                "type": "paragraph",
                "content": [{ "type": "text", "text": line }]
            })
        };
        content.push(node);
    }

    json!({
        "type": "doc",
        "version": 1,
        "content": content
    })
}

fn update_issue_priority_after_create<Gateway>(
    gateway: &mut Gateway,
    sync_repository: &SyncRepository<'_>,
    sync_attempt_id: &str,
    tray_id: &str,
    task: &LocalTask,
    jira_key: &str,
) -> Result<(), String>
where
    Gateway: JiraIssueGateway,
{
    let payload = json!({
        "fields": {
            "priority": priority_value(None, &task.priority),
        }
    });

    match gateway.update_issue_fields(jira_key, payload) {
        Ok(()) => {
            sync_repository
                .record_event(
                    sync_attempt_id,
                    tray_id,
                    Some(&task.id),
                    "jira.issue.priority.updated",
                    "succeeded",
                    JIRA_PROVIDER_OPERATION,
                    json!({
                        "jiraKey": jira_key,
                        "priority": task.priority,
                        "source": "post-create",
                    }),
                )
                .map_err(db_error_message)?;
            Ok(())
        }
        Err(message) => {
            sync_repository
                .record_event(
                    sync_attempt_id,
                    tray_id,
                    Some(&task.id),
                    "jira.issue.priority.update_failed",
                    "failed",
                    JIRA_PROVIDER_OPERATION,
                    json!({
                        "jiraKey": jira_key,
                        "priority": task.priority,
                        "message": audit_error_message(&message),
                    }),
                )
                .map_err(db_error_message)?;
            Err(message)
        }
    }
}

fn jira_parent_summary(task: &LocalTask) -> String {
    let title = task.title.trim();
    let area_code = task.area.trim();
    if area_code.is_empty() {
        return title.to_string();
    }

    let prefix = format!("[{area_code}]");
    let normalized_title = title.to_lowercase();
    let normalized_prefix = prefix.to_lowercase();
    if normalized_title == normalized_prefix
        || normalized_title.starts_with(&format!("{normalized_prefix} "))
    {
        title.to_string()
    } else {
        format!("{prefix} {title}")
    }
}

fn jira_subtask_summary(task: &LocalTask) -> String {
    task.title.trim().to_string()
}

fn priority_value(priority_field: Option<&JiraCreateFieldMetadata>, local_priority: &str) -> Value {
    let Some(priority_field) = priority_field else {
        return json!({ "name": local_priority });
    };

    let allowed_value = priority_field
        .allowed_values
        .iter()
        .find(|allowed_value| allowed_value_matches(allowed_value, local_priority));
    match allowed_value {
        Some(allowed_value) if allowed_value.id.is_some() => {
            json!({ "id": allowed_value.id.as_ref().expect("checked above") })
        }
        Some(allowed_value) if allowed_value.name.is_some() => {
            json!({ "name": allowed_value.name.as_ref().expect("checked above") })
        }
        Some(allowed_value) if allowed_value.value.is_some() => {
            json!({ "value": allowed_value.value.as_ref().expect("checked above") })
        }
        _ => json!({ "name": local_priority }),
    }
}

fn allowed_value_matches(allowed_value: &JiraCreateAllowedValue, local_priority: &str) -> bool {
    [
        allowed_value.name.as_deref(),
        allowed_value.value.as_deref(),
    ]
    .into_iter()
    .flatten()
    .any(|value| value.eq_ignore_ascii_case(local_priority))
}

fn labels_for(local_project: &str, area: &str) -> Vec<String> {
    [JIRA_TASK_FORGE_LABEL, local_project, area]
        .into_iter()
        .filter_map(sanitize_jira_label)
        .fold(Vec::<String>::new(), |mut labels, label| {
            if !labels.iter().any(|existing| existing == &label) {
                labels.push(label);
            }
            labels
        })
}

fn sanitize_jira_label(value: &str) -> Option<String> {
    let label = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, '_' | '-') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if label.is_empty() {
        None
    } else {
        Some(label)
    }
}

fn report_jira_create_progress<F>(
    report_progress: &mut F,
    sync_attempt_id: Option<&str>,
    step: &str,
    label: &str,
    detail: Option<&str>,
    completed_steps: usize,
    total_steps: usize,
    status: &str,
) where
    F: FnMut(JiraCreateProgress),
{
    report_progress(JiraCreateProgress {
        sync_attempt_id: sync_attempt_id.map(str::to_string),
        step: step.to_string(),
        label: label.to_string(),
        detail: detail.map(str::to_string),
        completed_steps,
        total_steps,
        status: status.to_string(),
    });
}

fn record_task_failure(
    connection: &Connection,
    sync_repository: &SyncRepository<'_>,
    sync_attempt_id: &str,
    tray_id: &str,
    task: &LocalTask,
    message: &str,
    result: &mut JiraCreateIssuesResult,
    event_type: &str,
) -> Result<(), String> {
    TaskRepository::new(connection)
        .mark_jira_failed(&task.id)
        .map_err(db_error_message)?;
    sync_repository
        .record_event(
            sync_attempt_id,
            tray_id,
            Some(&task.id),
            event_type,
            "failed",
            JIRA_PROVIDER_OPERATION,
            audit_error_detail(message),
        )
        .map_err(db_error_message)?;
    result.failed_issue_count += 1;
    result.failed_tasks.push(JiraFailedTaskResult {
        task_id: task.id.clone(),
        title: task.title.clone(),
        project: task.project.clone(),
        area: task.area.clone(),
        message: message.to_string(),
    });
    Ok(())
}

fn escape_jql_identifier(value: &str) -> String {
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        value.to_string()
    } else {
        format!("\"{}\"", escape_jql_string(value))
    }
}

fn escape_jql_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn db_error_message(error: DbError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_database;
    use crate::models::{JiraCreateIssueTypeMetadata, JqlResult, NewTask, NewTray};
    use crate::repositories::{TaskRepository, TrayRepository};

    #[test]
    fn creates_missing_epic_and_parent_issue_then_persists_task_link() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Jira sync".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Fix timer drift".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-10".to_string(), "JTFTEST-11".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issue_count, 1);
        assert_eq!(result.failed_issue_count, 0);
        assert_eq!(result.created_issues[0].key, "JTFTEST-11");
        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task remains");
        assert_eq!(persisted_task.sync_status, "Created");
        assert_eq!(persisted_task.jira_key.as_deref(), Some("JTFTEST-11"));
        assert_eq!(persisted_task.epic_key.as_deref(), Some("JTFTEST-10"));

        assert_eq!(gateway.created_payloads.len(), 2);
        assert_eq!(
            gateway.created_payloads[0]["fields"]["summary"],
            json!("[STT] Bug")
        );
        assert_eq!(
            gateway.created_payloads[1]["fields"]["parent"]["key"],
            json!("JTFTEST-10")
        );
        assert_eq!(
            gateway.created_payloads[1]["fields"]["priority"]["id"],
            json!("4")
        );
        assert_eq!(
            gateway.created_payloads[1]["fields"]["summary"],
            json!("[Bug] Fix timer drift")
        );
        assert_eq!(
            gateway.created_payloads[1]["properties"][0]["value"]["localTaskId"],
            json!(task.id)
        );
    }

    #[test]
    fn skips_exported_tasks_unless_api_creation_includes_them() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Exported mix".to_string(),
            })
            .expect("tray creates");
        let exported_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Already exported".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("exported task creates");
        let pending_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Fresh API task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("pending task creates");
        task_repository
            .mark_csv_exported(&[exported_task.id.clone()])
            .expect("task marks exported");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-10".to_string(), "JTFTEST-11".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray_with_progress(&tray.id, true, false, |_| {})
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issue_count, 1);
        assert_eq!(result.skipped_issue_count, 1);
        assert_eq!(gateway.created_payloads.len(), 2);
        assert_eq!(
            gateway.created_payloads[1]["fields"]["summary"],
            json!("[Bug] Fresh API task")
        );
        let persisted_tasks = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list");
        let persisted_exported = persisted_tasks
            .iter()
            .find(|task| task.id == exported_task.id)
            .expect("exported task remains");
        let persisted_pending = persisted_tasks
            .iter()
            .find(|task| task.id == pending_task.id)
            .expect("pending task remains");
        assert_eq!(persisted_exported.sync_status, "Exported");
        assert_eq!(persisted_exported.jira_key, None);
        assert_eq!(persisted_pending.sync_status, "Created");
    }

    #[test]
    fn creates_subtasks_after_parent_issue_creation() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Sub-task sync".to_string(),
            })
            .expect("tray creates");
        let parent_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Parent with child".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("parent task creates");
        let subtask = create_subtask_row(
            &connection,
            &tray.id,
            Some(&parent_task.id),
            "Implement child step",
        );
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec![
            "JTFTEST-10".to_string(),
            "JTFTEST-11".to_string(),
            "JTFTEST-12".to_string(),
        ];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issue_count, 2);
        assert_eq!(result.failed_issue_count, 0);
        assert_eq!(result.created_issues[0].key, "JTFTEST-11");
        assert_eq!(result.created_issues[1].key, "JTFTEST-12");
        assert_eq!(result.created_issues[1].issue_type, "Sub-task");
        assert_eq!(result.created_issues[1].summary, "Implement child step");

        assert_eq!(gateway.created_payloads.len(), 3);
        assert_eq!(
            gateway.created_payloads[2]["fields"]["parent"]["key"],
            json!("JTFTEST-11")
        );
        assert_eq!(
            gateway.created_payloads[2]["properties"][0]["value"]["kind"],
            json!("subtask")
        );
        assert_eq!(
            gateway.created_payloads[2]["properties"][0]["value"]["parentLocalTaskId"],
            json!(parent_task.id)
        );

        let tasks = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list");
        let persisted_subtask = tasks
            .iter()
            .find(|candidate| candidate.id == subtask.id)
            .expect("subtask remains");
        assert_eq!(persisted_subtask.sync_status, "Created");
        assert_eq!(persisted_subtask.jira_key.as_deref(), Some("JTFTEST-12"));
        assert_eq!(persisted_subtask.epic_key, None);
    }

    #[test]
    fn creates_pending_subtask_when_parent_already_has_jira_key() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Sub-task retry".to_string(),
            })
            .expect("tray creates");
        let parent_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Already created parent".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("parent task creates");
        task_repository
            .mark_jira_created(
                &parent_task.id,
                "JTFTEST-30",
                "https://example.atlassian.net/browse/JTFTEST-30",
                "JTFTEST-29",
            )
            .expect("parent marked created");
        let subtask = create_subtask_row(
            &connection,
            &tray.id,
            Some(&parent_task.id),
            "Retry child only",
        );
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-31".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issue_count, 1);
        assert_eq!(result.skipped_issue_count, 1);
        assert_eq!(gateway.created_payloads.len(), 1);
        assert_eq!(
            gateway.created_payloads[0]["fields"]["parent"]["key"],
            json!("JTFTEST-30")
        );

        let persisted_subtask = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == subtask.id)
            .expect("subtask remains");
        assert_eq!(persisted_subtask.sync_status, "Created");
        assert_eq!(persisted_subtask.jira_key.as_deref(), Some("JTFTEST-31"));
    }

    #[test]
    fn fails_subtask_without_parent_jira_key_without_recreating_parent() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Missing parent key".to_string(),
            })
            .expect("tray creates");
        let parent_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Local parent only".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("parent task creates");
        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created', jira_key = NULL, jira_url = NULL WHERE id = ?1",
                [&parent_task.id],
            )
            .expect("parent marked created without key");
        let subtask = create_subtask_row(
            &connection,
            &tray.id,
            Some(&parent_task.id),
            "Cannot create child",
        );
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = Vec::new();

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns failure result");

        assert_eq!(result.status, "failed");
        assert_eq!(result.created_issue_count, 0);
        assert_eq!(result.failed_issue_count, 1);
        assert!(gateway.created_payloads.is_empty());
        assert!(result
            .failed_tasks
            .iter()
            .any(|failure| failure.task_id == subtask.id
                && failure.message.contains("parent has no Jira key")));
    }

    #[test]
    fn does_not_duplicate_area_prefix_when_title_already_has_it() {
        let task = LocalTask {
            id: "task-1".to_string(),
            tray_id: "tray-1".to_string(),
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "[Bug] Fix timer drift".to_string(),
            priority: "High".to_string(),
            issue_type: "Bug".to_string(),
            sync_status: "Pending".to_string(),
            description_status: "Missing".to_string(),
            description: None,
            content_language: "Spanish".to_string(),
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            task_order: 0,
            created_at: "2026-05-24T00:00:00Z".to_string(),
            updated_at: "2026-05-24T00:00:00Z".to_string(),
        };

        assert_eq!(jira_parent_summary(&task), "[Bug] Fix timer drift");
    }

    #[test]
    fn updates_priority_after_create_when_create_metadata_omits_priority_field() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "JTFTEST priority".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "JTF Live QA".to_string(),
                area: "Programacion".to_string(),
                title: "Verify priority fallback".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.metadata = jtf_test_metadata("JTFTEST");
        gateway.created_keys = vec!["JTFTEST-2".to_string(), "JTFTEST-3".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issues[0].key, "JTFTEST-3");
        assert!(gateway.created_payloads[1]["fields"]["priority"].is_null());
        assert_eq!(gateway.updated_payloads.len(), 1);
        assert_eq!(gateway.updated_payloads[0].0, "JTFTEST-3");
        assert_eq!(
            gateway.updated_payloads[0].1["fields"]["priority"]["name"],
            json!("High")
        );

        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task remains");
        assert_eq!(persisted_task.sync_status, "Created");
        assert_eq!(persisted_task.jira_key.as_deref(), Some("JTFTEST-3"));
    }

    #[test]
    fn preserves_created_issue_when_post_create_priority_update_fails() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Priority warning".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "JTF Live QA".to_string(),
                area: "Programacion".to_string(),
                title: "Priority warning stays safe".to_string(),
                priority: "Highest".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.metadata = jtf_test_metadata("JTFTEST");
        gateway.created_keys = vec!["JTFTEST-2".to_string(), "JTFTEST-3".to_string()];
        gateway
            .update_failures
            .push("priority is not editable".to_string());

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns warning result");

        assert_eq!(result.status, "partial");
        assert_eq!(result.created_issue_count, 1);
        assert_eq!(result.failed_issue_count, 0);
        assert!(result
            .messages
            .iter()
            .any(|message| message.contains("priority could not be set")));

        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task remains");
        assert_eq!(persisted_task.sync_status, "Created");
        assert_eq!(persisted_task.jira_key.as_deref(), Some("JTFTEST-3"));
    }

    #[test]
    fn blocks_missing_descriptions_until_user_confirms() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Needs review".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Fix missing description flow".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, false)
            .expect("sync blocks cleanly");

        assert_eq!(result.status, "blocked");
        assert!(result.messages.iter().any(|message| {
            message.contains("Confirm missing descriptions before creating it in Jira")
        }));
        assert!(gateway.created_payloads.is_empty());
        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task remains");
        assert_eq!(persisted_task.sync_status, "Pending");
    }

    #[test]
    fn continues_healthy_groups_when_another_epic_creation_fails() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Partial sync".to_string(),
            })
            .expect("tray creates");
        let failing_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Fails with epic".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let healthy_task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "ZZ STUDIO".to_string(),
                area: "Programacion".to_string(),
                title: "Creates after failed group".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway
            .create_failures
            .push("Epic create failed".to_string());
        gateway.created_keys = vec!["JTFTEST-20".to_string(), "JTFTEST-21".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns partial result");

        assert_eq!(result.status, "partial");
        assert_eq!(result.created_issue_count, 1);
        assert_eq!(result.failed_issue_count, 1);
        let tasks = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list");
        assert_eq!(
            tasks
                .iter()
                .find(|task| task.id == failing_task.id)
                .expect("failed task")
                .sync_status,
            "Failed"
        );
        assert_eq!(
            tasks
                .iter()
                .find(|task| task.id == healthy_task.id)
                .expect("healthy task")
                .sync_status,
            "Created"
        );
    }

    #[test]
    fn creates_with_jira_localized_metadata_required_reporter_and_no_priority_field() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "JTFTEST metadata".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "JTF Live QA".to_string(),
                area: "Bug".to_string(),
                title: "Uses localized Jira metadata".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.metadata = jtf_test_metadata("JTFTEST");
        gateway.created_keys = vec!["JTFTEST-2".to_string(), "JTFTEST-3".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issues[0].key, "JTFTEST-3");
        assert_eq!(result.created_issues[0].issue_type, "Bug");
        assert_eq!(
            gateway.created_payloads[1]["fields"]["issuetype"]["id"],
            json!("10044")
        );
        assert_eq!(
            gateway.created_payloads[1]["fields"]["reporter"]["accountId"],
            json!("account-1")
        );
        assert!(gateway.created_payloads[1]["fields"]["priority"].is_null());
        assert_eq!(
            gateway.updated_payloads[0].1["fields"]["priority"]["name"],
            json!("Medium")
        );

        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task remains");
        assert_eq!(persisted_task.jira_key.as_deref(), Some("JTFTEST-3"));
    }

    struct FakeJiraGateway {
        metadata: JiraCreateMetadata,
        created_payloads: Vec<Value>,
        updated_payloads: Vec<(String, Value)>,
        created_keys: Vec<String>,
        create_failures: Vec<String>,
        update_failures: Vec<String>,
    }

    impl FakeJiraGateway {
        fn new() -> Self {
            Self {
                metadata: test_metadata("JTFTEST"),
                created_payloads: Vec::new(),
                updated_payloads: Vec::new(),
                created_keys: Vec::new(),
                create_failures: Vec::new(),
                update_failures: Vec::new(),
            }
        }
    }

    impl JiraIssueGateway for FakeJiraGateway {
        fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String> {
            let mut metadata = self.metadata.clone();
            metadata.project_key = project_key.to_string();
            Ok(metadata)
        }

        fn current_user(&mut self) -> Result<JiraMyself, String> {
            Ok(JiraMyself {
                account_id: Some("account-1".to_string()),
                display_name: Some("QA User".to_string()),
                email_address: Some("qa@example.com".to_string()),
            })
        }

        fn search_jql(
            &mut self,
            _jql: &str,
            _max_results: usize,
        ) -> Result<JqlSearchResponse, String> {
            Ok(JqlSearchResponse {
                results: Vec::<JqlResult>::new(),
                is_last: true,
                next_page_token: None,
                warning_messages: Vec::new(),
            })
        }

        fn create_issue(&mut self, payload: Value) -> Result<JiraCreateIssueResponse, String> {
            self.created_payloads.push(payload);
            if !self.create_failures.is_empty() {
                return Err(self.create_failures.remove(0));
            }

            let key = self.created_keys.remove(0);
            Ok(JiraCreateIssueResponse {
                id: key.trim_start_matches("JTFTEST-").to_string(),
                key: key.clone(),
                self_url: format!("https://example.atlassian.net/rest/api/3/issue/{key}"),
            })
        }

        fn update_issue_fields(&mut self, key: &str, payload: Value) -> Result<(), String> {
            self.updated_payloads.push((key.to_string(), payload));
            if !self.update_failures.is_empty() {
                return Err(self.update_failures.remove(0));
            }

            Ok(())
        }

        fn issue_browse_url(&self, key: &str) -> String {
            format!("https://example.atlassian.net/browse/{key}")
        }
    }

    fn test_metadata(project_key: &str) -> JiraCreateMetadata {
        JiraCreateMetadata {
            project_key: project_key.to_string(),
            issue_types: vec![
                issue_type("10000", "Epic", IssueTypeRole::Epic),
                issue_type("10001", "Historia", IssueTypeRole::Story),
                issue_type("10002", "Bug", IssueTypeRole::Bug),
                subtask_issue_type("10003", "Sub-task"),
            ],
        }
    }

    fn jtf_test_metadata(project_key: &str) -> JiraCreateMetadata {
        JiraCreateMetadata {
            project_key: project_key.to_string(),
            issue_types: vec![
                localized_issue_type("10039", "Epic", IssueTypeRole::Epic),
                localized_issue_type("10042", "Historia", IssueTypeRole::Story),
                localized_issue_type("10044", "Error", IssueTypeRole::Bug),
                subtask_issue_type("10045", "Subtarea"),
            ],
        }
    }

    fn issue_type(id: &str, name: &str, role: IssueTypeRole) -> JiraCreateIssueTypeMetadata {
        let mut fields = vec![
            field("project", "Project", true),
            field("issuetype", "Issue Type", true),
            field("summary", "Summary", true),
            field("labels", "Labels", false),
            priority_field(),
        ];
        if matches!(role, IssueTypeRole::Story | IssueTypeRole::Bug) {
            fields.push(field("parent", "Parent", false));
        }

        JiraCreateIssueTypeMetadata {
            id: id.to_string(),
            name: name.to_string(),
            subtask: false,
            fields,
        }
    }

    fn localized_issue_type(
        id: &str,
        name: &str,
        role: IssueTypeRole,
    ) -> JiraCreateIssueTypeMetadata {
        let mut fields = vec![
            field("project", "Proyecto", true),
            field("issuetype", "Tipo de Incidencia", true),
            field("summary", "Resumen", true),
            field("labels", "Etiquetas", false),
            field("reporter", "Informador", true),
        ];
        if matches!(role, IssueTypeRole::Story | IssueTypeRole::Bug) {
            fields.push(field("parent", "Principal", false));
        }

        JiraCreateIssueTypeMetadata {
            id: id.to_string(),
            name: name.to_string(),
            subtask: false,
            fields,
        }
    }

    fn subtask_issue_type(id: &str, name: &str) -> JiraCreateIssueTypeMetadata {
        JiraCreateIssueTypeMetadata {
            id: id.to_string(),
            name: name.to_string(),
            subtask: true,
            fields: vec![
                field("project", "Project", true),
                field("issuetype", "Issue Type", true),
                field("summary", "Summary", true),
                field("parent", "Parent", true),
                field("labels", "Labels", false),
                priority_field(),
            ],
        }
    }

    fn create_subtask_row(
        connection: &Connection,
        tray_id: &str,
        parent_task_id: Option<&str>,
        title: &str,
    ) -> LocalTask {
        let task_repository = TaskRepository::new(connection);
        let task_order = task_repository
            .list_for_tray(tray_id)
            .expect("tasks list")
            .len() as i64;
        let id = uuid::Uuid::new_v4().to_string();
        let now = "2026-05-25T00:00:00Z";
        connection
            .execute(
                "
                INSERT INTO tasks (
                    id, tray_id, project, area, title, priority, issue_type, sync_status,
                    description_status, description, content_language, jira_key, jira_url, epic_key,
                    parent_task_id, task_order, created_at, updated_at
                )
                VALUES (?1, ?2, 'STT', 'Programacion', ?3, 'Medium', 'Sub-task', 'Pending',
                    'Ready', NULL, 'Spanish', NULL, NULL, NULL, ?4, ?5, ?6, ?6)
                ",
                (id.as_str(), tray_id, title, parent_task_id, task_order, now),
            )
            .expect("subtask inserts");
        task_repository
            .list_for_tray(tray_id)
            .expect("tasks list")
            .into_iter()
            .find(|task| task.id == id)
            .expect("subtask exists")
    }

    fn field(key: &str, name: &str, required: bool) -> JiraCreateFieldMetadata {
        JiraCreateFieldMetadata {
            key: key.to_string(),
            name: name.to_string(),
            required,
            allowed_values: Vec::new(),
            schema: None,
        }
    }

    fn priority_field() -> JiraCreateFieldMetadata {
        JiraCreateFieldMetadata {
            key: "priority".to_string(),
            name: "Priority".to_string(),
            required: false,
            allowed_values: ["Lowest", "Low", "Medium", "High", "Highest"]
                .into_iter()
                .enumerate()
                .map(|(index, name)| JiraCreateAllowedValue {
                    id: Some((index + 1).to_string()),
                    name: Some(name.to_string()),
                    value: None,
                })
                .collect(),
            schema: None,
        }
    }
}
