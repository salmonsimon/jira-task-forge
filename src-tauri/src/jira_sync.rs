mod attempt_recorder;
mod planning;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use rusqlite::Connection;
use serde_json::{json, Value};

use crate::area_catalog::{catalog_area_display_name, catalog_jira_label};
use crate::attachment_storage::{
    remove_managed_attachment_file, resolve_existing_managed_attachment_file,
    sanitize_attachment_audit_name, JIRA_CLOUD_FALLBACK_ATTACHMENT_UPLOAD_LIMIT_BYTES,
};
use crate::db::DbError;
use crate::epic_scope::EpicTarget;
use crate::integrations::jira::JiraClient;
use crate::models::{
    JiraAttachmentSettings, JiraCreateAllowedValue, JiraCreateFieldMetadata,
    JiraCreateIssueResponse, JiraCreateIssuesResult, JiraCreateMetadata, JiraCreateProgress,
    JiraCreatedIssueResult, JiraMyself, JiraRemoteMarkerIssue, JqlSearchResponse, LocalTask,
    TaskAttachment,
};
use crate::repositories::{TaskRepository, TrayRepository};
use crate::sync_audit::{
    attachment_error_detail, attachment_uploaded_detail, jira_epic_detail,
    jira_epic_resolved_detail, jira_issue_created_detail, jira_priority_detail,
    jira_priority_error_detail, jira_remote_marker_recovered_detail, jira_subtask_created_detail,
};

use attempt_recorder::SyncAttemptRecorder;
use planning::{
    issue_type_name_matches, EpicLinkStyle, IssueTypePlan, IssueTypeRole, JiraCreationPlan,
    JiraCreationPlanningOptions, JiraCreationTaskScope,
};

const JIRA_TASK_FORGE_PROPERTY_KEY: &str = "jira-task-forge-sync";
const JIRA_ATTACHMENT_BYTES_CLEANED_STATUS: &str = "Uploaded to Jira; local bytes cleaned";
const AI_ONLY_BYTES_CLEANED_STATUS: &str = "Created in Jira; local AI-only bytes cleaned";
const REMOTE_MARKER_LOOKUP_ATTEMPTS: usize = 2;
const REMOTE_MARKER_LOOKUP_BACKOFF: Duration = Duration::from_millis(100);

pub trait JiraIssueGateway {
    fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String>;
    fn attachment_settings(&mut self) -> Result<JiraAttachmentSettings, String>;
    fn current_user(&mut self) -> Result<JiraMyself, String>;
    fn search_jql(&mut self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String>;
    fn find_parent_issue_by_remote_marker(
        &mut self,
        project_key: &str,
        issue_type: &str,
        summary: &str,
        local_task_id: &str,
    ) -> Result<Option<JiraRemoteMarkerIssue>, String>;
    fn create_issue(&mut self, payload: Value) -> Result<JiraCreateIssueResponse, String>;
    fn update_issue_fields(&mut self, key: &str, payload: Value) -> Result<(), String>;
    fn upload_attachment(
        &mut self,
        key: &str,
        filename: &str,
        mime_type: Option<&str>,
        bytes: Vec<u8>,
    ) -> Result<(), String>;
    fn issue_browse_url(&self, key: &str) -> String;
}

impl JiraIssueGateway for JiraClient {
    fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String> {
        self.get_create_issue_metadata(project_key)
    }

    fn attachment_settings(&mut self) -> Result<JiraAttachmentSettings, String> {
        self.get_attachment_settings()
    }

    fn current_user(&mut self) -> Result<JiraMyself, String> {
        self.get_myself()
    }

    fn search_jql(&mut self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String> {
        JiraClient::search_jql(self, jql, max_results)
    }

    fn find_parent_issue_by_remote_marker(
        &mut self,
        project_key: &str,
        issue_type: &str,
        summary: &str,
        local_task_id: &str,
    ) -> Result<Option<JiraRemoteMarkerIssue>, String> {
        JiraClient::find_parent_issue_by_remote_marker(
            self,
            project_key,
            JIRA_TASK_FORGE_PROPERTY_KEY,
            issue_type,
            summary,
            local_task_id,
        )
    }

    fn create_issue(&mut self, payload: Value) -> Result<JiraCreateIssueResponse, String> {
        JiraClient::create_issue(self, payload)
    }

    fn update_issue_fields(&mut self, key: &str, payload: Value) -> Result<(), String> {
        JiraClient::update_issue_fields(self, key, payload)
    }

    fn upload_attachment(
        &mut self,
        key: &str,
        filename: &str,
        mime_type: Option<&str>,
        bytes: Vec<u8>,
    ) -> Result<(), String> {
        JiraClient::upload_attachment(self, key, filename, mime_type, bytes)
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
    app_data_dir: Option<PathBuf>,
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
            app_data_dir: None,
        }
    }

    pub fn with_app_data_dir(mut self, app_data_dir: PathBuf) -> Self {
        self.app_data_dir = Some(app_data_dir);
        self
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
            true,
            |_| {},
        )
    }

    pub fn create_parent_issues_from_tray_with_progress<F>(
        &mut self,
        tray_id: &str,
        allow_missing_descriptions: bool,
        include_exported_tasks: bool,
        include_missing_description_tasks: bool,
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
        let mut recorder = SyncAttemptRecorder::start(
            self.connection,
            tray_id,
            &tray.name,
            &self.creation_project_key,
            include_exported_tasks,
            include_missing_description_tasks,
            &mut report_progress,
        )?;
        let mut result = recorder.running_result();

        let task_scope = JiraCreationTaskScope::from_tasks(
            &tasks,
            JiraCreationPlanningOptions {
                creation_project_key: &self.creation_project_key,
                epic_scope: tray.epic_scope.as_deref(),
                transversal_epic_scope: tray.transversal_epic_scope.as_deref(),
                allow_missing_descriptions,
                include_exported_tasks,
                include_missing_description_tasks,
            },
        );
        let createable_task_count = task_scope.createable_task_count;
        result.skipped_issue_count = task_scope.skipped_issue_count;
        recorder.set_total_steps(task_scope.progress_total_steps);
        recorder.progress(
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
            "running",
        );

        if !task_scope.local_blockers.is_empty() {
            recorder.progress(
                "blocked",
                "Jira creation blocked",
                task_scope.local_blockers.first().map(String::as_str),
                "failed",
            );
            return recorder.finish_blocked(task_scope.local_blockers, result);
        }
        recorder.advance();

        let mut had_non_blocking_warning = false;
        recorder.progress(
            "attachments",
            "Checking Jira attachments",
            Some("Validating managed files and Jira upload limits"),
            "running",
        );
        match validate_attachment_upload_preflight(
            self.app_data_dir.as_deref(),
            self.gateway,
            task_scope
                .parent_tasks
                .iter()
                .chain(task_scope.subtask_tasks.iter()),
        ) {
            Ok(warnings) => {
                if !warnings.is_empty() {
                    had_non_blocking_warning = true;
                    result.messages.extend(warnings);
                }
            }
            Err(messages) => {
                recorder.progress(
                    "attachments",
                    "Jira attachment validation blocked creation",
                    messages.first().map(String::as_str),
                    "failed",
                );
                return recorder.finish_blocked(messages, result);
            }
        }

        recorder.progress(
            "metadata",
            "Reading Jira create metadata",
            Some(&self.creation_project_key),
            "running",
        );
        let metadata = match self.gateway.create_metadata(&self.creation_project_key) {
            Ok(metadata) => metadata,
            Err(message) => {
                recorder.progress(
                    "metadata",
                    "Could not read Jira metadata",
                    Some(&message),
                    "failed",
                );
                return recorder.finish_blocked(
                    vec![format!("Could not read Jira create metadata: {message}")],
                    result,
                );
            }
        };
        recorder.advance();
        let plan = match task_scope.with_metadata(&metadata) {
            Ok(plan) => plan,
            Err(messages) => {
                recorder.progress(
                    "metadata",
                    "Jira metadata cannot create these tasks",
                    messages.first().map(String::as_str),
                    "failed",
                );
                return recorder.finish_blocked(messages, result);
            }
        };
        if !plan.missing_description_blockers.is_empty() {
            recorder.progress(
                "metadata",
                "Jira metadata requires descriptions",
                plan.missing_description_blockers
                    .first()
                    .map(String::as_str),
                "failed",
            );
            return recorder.finish_blocked(plan.missing_description_blockers, result);
        }

        recorder.record_metadata_preflight(
            &self.creation_project_key,
            plan.issue_type_names(),
            createable_task_count,
        )?;

        recorder.progress(
            "account",
            if plan.requires_reporter() {
                "Reading Jira account"
            } else {
                "Preparing Jira creation plan"
            },
            Some("Checking required Jira fields"),
            "running",
        );
        let reporter_account_id = if plan.requires_reporter() {
            match self.gateway.current_user() {
                Ok(user) => match user.account_id {
                    Some(account_id) if !account_id.trim().is_empty() => Some(account_id),
                    _ => {
                        recorder.progress(
                            "account",
                            "Could not resolve Jira reporter",
                            Some("The current Jira account id was empty."),
                            "failed",
                        );
                        return recorder.finish_blocked(
                            vec![
                                "Jira create metadata requires Reporter, but the current Jira account id could not be resolved."
                                    .to_string(),
                            ],
                            result,
                        );
                    }
                },
                Err(message) => {
                    recorder.progress(
                        "account",
                        "Could not read Jira account",
                        Some(&message),
                        "failed",
                    );
                    return recorder.finish_blocked(
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
        recorder.advance();

        let mut parent_jira_keys = tasks
            .iter()
            .filter_map(|task| {
                task.jira_key
                    .as_ref()
                    .filter(|key| !key.trim().is_empty())
                    .map(|key| (task.id.clone(), key.clone()))
            })
            .collect::<HashMap<_, _>>();
        for (target, group_tasks) in &plan.epic_target_groups {
            let epic_summary = target.summary();
            recorder.progress(
                "epic",
                "Resolving Jira epic",
                Some(&epic_summary),
                "running",
            );
            let epic_key = match resolve_or_create_epic(
                self.gateway,
                &recorder,
                &plan,
                &self.creation_project_key,
                target,
                reporter_account_id.as_deref(),
            ) {
                Ok(key) => {
                    recorder.advance();
                    recorder.progress(
                        "epic",
                        "Jira epic ready",
                        Some(&format!("{epic_summary} -> {key}")),
                        "running",
                    );
                    key
                }
                Err(message) => {
                    recorder.advance();
                    recorder.progress(
                        "epic",
                        "Could not resolve Jira epic",
                        Some(&message),
                        "running",
                    );
                    for task in group_tasks {
                        recorder.record_task_failure(
                            &task,
                            &message,
                            &mut result,
                            "jira.epic.resolve",
                        )?;
                        recorder.advance();
                    }
                    continue;
                }
            };

            for task in group_tasks {
                let parent_summary = jira_parent_summary(&task);
                recorder.progress(
                    "issue",
                    "Creating Jira issue",
                    Some(&parent_summary),
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
                    had_non_blocking_warning |= upload_task_attachments(
                        self.connection,
                        self.app_data_dir.as_deref(),
                        self.gateway,
                        &mut recorder,
                        task,
                        existing_key,
                        &mut result,
                    )?;
                    had_non_blocking_warning |= cleanup_ai_only_attachments_after_created(
                        self.connection,
                        self.app_data_dir.as_deref(),
                        task,
                        &mut result,
                    )?;
                    recorder.advance();
                    continue;
                }

                let issue_type = plan
                    .issue_type_for_local(&task.issue_type)
                    .expect("metadata plan should include validated parent issue type");

                if should_check_remote_marker_before_parent_create(&task) {
                    recorder.progress(
                        "issue",
                        "Checking Jira remote marker",
                        Some(&parent_summary),
                        "running",
                    );
                    match find_parent_issue_by_remote_marker_with_retry(
                        self.gateway,
                        &self.creation_project_key,
                        &issue_type.name,
                        &parent_summary,
                        &task.id,
                    ) {
                        Ok(Some(remote_issue)) => {
                            let existing_key = remote_issue.key;
                            let existing_url = self.gateway.issue_browse_url(&existing_key);
                            TaskRepository::new(self.connection)
                                .mark_jira_created(
                                    &task.id,
                                    &existing_key,
                                    &existing_url,
                                    &epic_key,
                                )
                                .map_err(db_error_message)?;
                            recorder.record_event(
                                Some(&task.id),
                                "jira.issue.remote_marker_recovered",
                                "succeeded",
                                jira_remote_marker_recovered_detail(&existing_key, &epic_key),
                            )?;
                            result.skipped_issue_count += 1;
                            result.messages.push(format!(
                                "{} recovered existing Jira issue {existing_key} from its remote marker.",
                                task.title
                            ));
                            parent_jira_keys.insert(task.id.clone(), existing_key.clone());
                            had_non_blocking_warning |= upload_task_attachments(
                                self.connection,
                                self.app_data_dir.as_deref(),
                                self.gateway,
                                &mut recorder,
                                task,
                                &existing_key,
                                &mut result,
                            )?;
                            had_non_blocking_warning |= cleanup_ai_only_attachments_after_created(
                                self.connection,
                                self.app_data_dir.as_deref(),
                                task,
                                &mut result,
                            )?;
                            recorder.advance();
                            continue;
                        }
                        Ok(None) => {
                            let message = "Could not confirm whether this failed task already exists in Jira: no Jira issue with a matching remote marker was found among the retry candidates. Review the task manually before retrying.";
                            recorder.record_task_failure(
                                &task,
                                message,
                                &mut result,
                                "jira.issue.remote_marker_lookup",
                            )?;
                            recorder.advance();
                            continue;
                        }
                        Err(message) => {
                            recorder.record_task_failure(
                                &task,
                                &message,
                                &mut result,
                                "jira.issue.remote_marker_lookup",
                            )?;
                            recorder.advance();
                            continue;
                        }
                    }
                }
                let payload = build_parent_issue_payload(
                    issue_type,
                    &self.creation_project_key,
                    &task,
                    &epic_key,
                    recorder.sync_attempt_id(),
                    reporter_account_id.as_deref(),
                );

                match self.gateway.create_issue(payload) {
                    Ok(created_issue) => {
                        let created_key = created_issue.key.clone();
                        let issue_url = self.gateway.issue_browse_url(&created_issue.key);
                        TaskRepository::new(self.connection)
                            .mark_jira_created(&task.id, &created_issue.key, &issue_url, &epic_key)
                            .map_err(db_error_message)?;
                        recorder.record_event(
                            Some(&task.id),
                            "jira.issue.created",
                            "succeeded",
                            jira_issue_created_detail(&created_key, &epic_key, &task.issue_type),
                        )?;
                        if issue_type.field("priority").is_none() {
                            match update_issue_priority_after_create(
                                self.gateway,
                                &recorder,
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
                            key: created_key.clone(),
                            url: issue_url,
                            issue_type: task.issue_type.clone(),
                            summary: jira_parent_summary(&task),
                            epic_key: Some(epic_key.clone()),
                        });
                        let created_key_for_upload = created_key.clone();
                        parent_jira_keys.insert(task.id.clone(), created_key);
                        had_non_blocking_warning |= upload_task_attachments(
                            self.connection,
                            self.app_data_dir.as_deref(),
                            self.gateway,
                            &mut recorder,
                            task,
                            &created_key_for_upload,
                            &mut result,
                        )?;
                        had_non_blocking_warning |= cleanup_ai_only_attachments_after_created(
                            self.connection,
                            self.app_data_dir.as_deref(),
                            task,
                            &mut result,
                        )?;
                        recorder.advance();
                    }
                    Err(message) => {
                        recorder.record_task_failure(
                            &task,
                            &message,
                            &mut result,
                            "jira.issue.create",
                        )?;
                        recorder.advance();
                    }
                }
            }
        }

        if let Some(subtask_issue_type) = plan.issue_types.subtask.as_ref() {
            for subtask in &plan.subtask_tasks {
                recorder.progress(
                    "subtask",
                    "Creating Jira sub-task",
                    Some(&subtask.title),
                    "running",
                );

                let Some(parent_task_id) = subtask.parent_task_id.as_deref() else {
                    recorder.record_task_failure(
                        &subtask,
                        "Sub-task is missing a parent local task.",
                        &mut result,
                        "jira.subtask.parent_missing",
                    )?;
                    recorder.advance();
                    continue;
                };
                let Some(parent_jira_key) = parent_jira_keys.get(parent_task_id) else {
                    recorder.record_task_failure(
                        &subtask,
                        "Sub-task parent has no Jira key yet.",
                        &mut result,
                        "jira.subtask.parent_missing",
                    )?;
                    recorder.advance();
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
                    had_non_blocking_warning |= upload_task_attachments(
                        self.connection,
                        self.app_data_dir.as_deref(),
                        self.gateway,
                        &mut recorder,
                        subtask,
                        existing_key,
                        &mut result,
                    )?;
                    had_non_blocking_warning |= cleanup_ai_only_attachments_after_created(
                        self.connection,
                        self.app_data_dir.as_deref(),
                        subtask,
                        &mut result,
                    )?;
                    recorder.advance();
                    continue;
                }

                let payload = build_subtask_issue_payload(
                    subtask_issue_type,
                    &self.creation_project_key,
                    &subtask,
                    parent_jira_key,
                    recorder.sync_attempt_id(),
                    reporter_account_id.as_deref(),
                );

                match self.gateway.create_issue(payload) {
                    Ok(created_issue) => {
                        let created_key = created_issue.key.clone();
                        let issue_url = self.gateway.issue_browse_url(&created_issue.key);
                        TaskRepository::new(self.connection)
                            .mark_jira_subtask_created(&subtask.id, &created_issue.key, &issue_url)
                            .map_err(db_error_message)?;
                        recorder.record_event(
                            Some(&subtask.id),
                            "jira.subtask.created",
                            "succeeded",
                            jira_subtask_created_detail(
                                &created_key,
                                parent_jira_key,
                                &subtask.issue_type,
                            ),
                        )?;
                        result.created_issue_count += 1;
                        result.created_issues.push(JiraCreatedIssueResult {
                            task_id: Some(subtask.id.clone()),
                            key: created_key.clone(),
                            url: issue_url,
                            issue_type: subtask.issue_type.clone(),
                            summary: jira_subtask_summary(&subtask),
                            epic_key: None,
                        });
                        had_non_blocking_warning |= upload_task_attachments(
                            self.connection,
                            self.app_data_dir.as_deref(),
                            self.gateway,
                            &mut recorder,
                            subtask,
                            &created_key,
                            &mut result,
                        )?;
                        had_non_blocking_warning |= cleanup_ai_only_attachments_after_created(
                            self.connection,
                            self.app_data_dir.as_deref(),
                            subtask,
                            &mut result,
                        )?;
                        recorder.advance();
                    }
                    Err(message) => {
                        recorder.record_task_failure(
                            &subtask,
                            &message,
                            &mut result,
                            "jira.subtask.create",
                        )?;
                        recorder.advance();
                    }
                }
            }
        }

        recorder.finish(result, had_non_blocking_warning)
    }
}

fn resolve_or_create_epic<Gateway, F>(
    gateway: &mut Gateway,
    recorder: &SyncAttemptRecorder<'_, '_, F>,
    plan: &JiraCreationPlan,
    jira_project_key: &str,
    target: &EpicTarget,
    reporter_account_id: Option<&str>,
) -> Result<String, String>
where
    Gateway: JiraIssueGateway,
    F: FnMut(JiraCreateProgress),
{
    let [epic_summary, fallback_summary] = target.searchable_summaries();
    let jql = format!(
        "project = {} AND (summary ~ \"{}\" OR summary ~ \"{}\") ORDER BY created DESC",
        escape_jql_identifier(jira_project_key),
        escape_jql_string(&epic_summary),
        escape_jql_string(&fallback_summary)
    );
    let search_response = gateway.search_jql(&jql, 20)?;
    let matching_epics = search_response
        .results
        .into_iter()
        .filter(|issue| issue_type_name_matches(&issue.issue_type, IssueTypeRole::Epic))
        .collect::<Vec<_>>();
    if let Some(existing_epic) = matching_epics
        .iter()
        .find(|issue| issue.summary == epic_summary)
        .or_else(|| {
            matching_epics
                .iter()
                .find(|issue| target.matches_existing_summary(&issue.summary))
        })
    {
        recorder.record_event(
            None,
            "jira.epic.resolved",
            "succeeded",
            jira_epic_resolved_detail(&existing_epic.key, &epic_summary, "search"),
        )?;
        return Ok(existing_epic.key.clone());
    }

    let payload = build_epic_payload(
        plan,
        jira_project_key,
        &target.local_project,
        &target.area,
        &epic_summary,
        recorder.sync_attempt_id(),
        reporter_account_id,
    );
    let created_epic = gateway.create_issue(payload)?;
    recorder.record_event(
        None,
        "jira.epic.created",
        "succeeded",
        jira_epic_detail(&created_epic.key, &epic_summary),
    )?;
    Ok(created_epic.key)
}

fn should_check_remote_marker_before_parent_create(task: &LocalTask) -> bool {
    task.sync_status == "Failed"
        && task
            .jira_key
            .as_deref()
            .is_none_or(|key| key.trim().is_empty())
}

fn find_parent_issue_by_remote_marker_with_retry<Gateway>(
    gateway: &mut Gateway,
    project_key: &str,
    issue_type: &str,
    summary: &str,
    local_task_id: &str,
) -> Result<Option<JiraRemoteMarkerIssue>, String>
where
    Gateway: JiraIssueGateway,
{
    let mut last_error = None;
    for attempt in 1..=REMOTE_MARKER_LOOKUP_ATTEMPTS {
        match gateway.find_parent_issue_by_remote_marker(
            project_key,
            issue_type,
            summary,
            local_task_id,
        ) {
            Ok(issue) => return Ok(issue),
            Err(message) if attempt < REMOTE_MARKER_LOOKUP_ATTEMPTS => {
                last_error = Some(message);
                thread::sleep(REMOTE_MARKER_LOOKUP_BACKOFF);
            }
            Err(message) => return Err(remote_marker_lookup_error(&message)),
        }
    }

    Err(remote_marker_lookup_error(&last_error.unwrap_or_else(
        || "Jira marker lookup could not reach Jira.".to_string(),
    )))
}

fn remote_marker_lookup_error(message: &str) -> String {
    format!(
        "Could not confirm whether this failed task already exists in Jira via remote marker lookup: {message}"
    )
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
        "labels": labels_for_area(area),
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
        "labels": labels_for_area(&task.area),
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
        "labels": labels_for_area(&task.area),
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

fn update_issue_priority_after_create<Gateway, F>(
    gateway: &mut Gateway,
    recorder: &SyncAttemptRecorder<'_, '_, F>,
    task: &LocalTask,
    jira_key: &str,
) -> Result<(), String>
where
    Gateway: JiraIssueGateway,
    F: FnMut(JiraCreateProgress),
{
    let payload = json!({
        "fields": {
            "priority": priority_value(None, &task.priority),
        }
    });

    match gateway.update_issue_fields(jira_key, payload) {
        Ok(()) => {
            recorder.record_event(
                Some(&task.id),
                "jira.issue.priority.updated",
                "succeeded",
                jira_priority_detail(jira_key, &task.priority, "post-create"),
            )?;
            Ok(())
        }
        Err(message) => {
            recorder.record_event(
                Some(&task.id),
                "jira.issue.priority.update_failed",
                "failed",
                jira_priority_error_detail(jira_key, &task.priority, &message),
            )?;
            Err(message)
        }
    }
}

fn validate_attachment_upload_preflight<'task, Gateway, Tasks>(
    app_data_dir: Option<&Path>,
    gateway: &mut Gateway,
    tasks: Tasks,
) -> Result<Vec<String>, Vec<String>>
where
    Gateway: JiraIssueGateway,
    Tasks: IntoIterator<Item = &'task LocalTask>,
{
    let attachments = tasks
        .into_iter()
        .flat_map(|task| task.attachments.iter())
        .filter(|attachment| is_jira_uploadable_attachment(attachment))
        .collect::<Vec<_>>();
    if attachments.is_empty() {
        return Ok(Vec::new());
    }

    let Some(app_data_dir) = app_data_dir else {
        return Err(vec![
            "Attachment upload could not find the app data directory. Remove Jira-ready attachments or retry from the desktop app."
                .to_string(),
        ]);
    };

    let mut warnings = Vec::new();
    let limit_bytes = match gateway.attachment_settings() {
        Ok(settings) => jira_attachment_upload_limit(&settings)?,
        Err(message) => {
            warnings.push(format!(
                "Could not read Jira attachment settings: {message}. Using Jira Cloud fallback limit of {} per file for this run.",
                format_byte_size_u64(JIRA_CLOUD_FALLBACK_ATTACHMENT_UPLOAD_LIMIT_BYTES)
            ));
            JIRA_CLOUD_FALLBACK_ATTACHMENT_UPLOAD_LIMIT_BYTES
        }
    };

    let mut blockers = Vec::new();
    for attachment in attachments {
        let filename = sanitize_attachment_audit_name(&attachment.display_filename);
        let managed_file = match resolve_existing_managed_attachment_file(
            app_data_dir,
            &attachment.original_relative_path,
        ) {
            Ok(file) => file,
            Err(error) => {
                blockers.push(format!(
                    "{filename} could not be validated as a managed attachment file: {error}"
                ));
                continue;
            }
        };

        if managed_file.size_bytes == 0 {
            blockers.push(format!(
                "{filename} is empty. Attach a non-empty file before creating it in Jira."
            ));
        } else if managed_file.size_bytes > limit_bytes {
            blockers.push(format!(
                "{} is {}. Jira allows attachments up to {} per file.",
                filename,
                format_byte_size_u64(managed_file.size_bytes),
                format_byte_size_u64(limit_bytes)
            ));
        }
    }

    if blockers.is_empty() {
        Ok(warnings)
    } else {
        Err(blockers)
    }
}

fn jira_attachment_upload_limit(settings: &JiraAttachmentSettings) -> Result<u64, Vec<String>> {
    if !settings.enabled {
        return Err(vec![
            "Jira attachments are disabled for this site. Remove Jira-ready attachments or ask a Jira admin to enable attachments."
                .to_string(),
        ]);
    }
    match u64::try_from(settings.upload_limit) {
        Ok(limit) if limit > 0 => Ok(limit),
        _ => Err(vec![
            "Jira did not report a valid attachment upload limit. Remove Jira-ready attachments or retry after checking Jira attachment settings."
                .to_string(),
        ]),
    }
}

fn is_jira_uploadable_attachment(attachment: &TaskAttachment) -> bool {
    matches!(
        attachment.purpose.as_str(),
        "Jira attachment" | "AI + Jira attachment"
    )
}

fn upload_task_attachments<Gateway, F>(
    connection: &Connection,
    app_data_dir: Option<&Path>,
    gateway: &mut Gateway,
    recorder: &mut SyncAttemptRecorder<'_, '_, F>,
    task: &LocalTask,
    jira_key: &str,
    result: &mut JiraCreateIssuesResult,
) -> Result<bool, String>
where
    Gateway: JiraIssueGateway,
    F: FnMut(JiraCreateProgress),
{
    let attachments = TaskRepository::new(connection)
        .list_jira_uploadable_attachments(&task.id)
        .map_err(db_error_message)?;
    if attachments.is_empty() {
        return Ok(false);
    }

    let mut had_warning = false;
    for attachment in attachments {
        let filename = sanitize_attachment_audit_name(&attachment.display_filename);
        recorder.progress(
            "attachment",
            "Uploading Jira attachment",
            Some(&filename),
            "running",
        );
        let Some(app_data_dir) = app_data_dir else {
            had_warning = true;
            let message = "Attachment upload could not find the app data directory.";
            recorder.record_event(
                Some(&task.id),
                "jira.attachment.upload_failed",
                "failed",
                attachment_error_detail(jira_key, &filename, message),
            )?;
            result.messages.push(format!(
                "{jira_key} attachment upload skipped for {}: {message}",
                filename
            ));
            continue;
        };

        let managed_file = match resolve_existing_managed_attachment_file(
            app_data_dir,
            &attachment.original_relative_path,
        ) {
            Ok(file) => file,
            Err(error) => {
                had_warning = true;
                let message = format!("Attachment file could not be validated: {error}");
                recorder.record_event(
                    Some(&task.id),
                    "jira.attachment.upload_failed",
                    "failed",
                    attachment_error_detail(jira_key, &filename, &message),
                )?;
                result.messages.push(format!(
                    "{jira_key} attachment {filename} could not be uploaded: {message}"
                ));
                continue;
            }
        };
        let bytes = match fs::read(&managed_file.absolute_path) {
            Ok(bytes) => bytes,
            Err(error) => {
                had_warning = true;
                let message = format!("Could not read local attachment file: {error}");
                recorder.record_event(
                    Some(&task.id),
                    "jira.attachment.upload_failed",
                    "failed",
                    attachment_error_detail(jira_key, &filename, &message),
                )?;
                result.messages.push(format!(
                    "{jira_key} attachment {filename} could not be uploaded: {message}"
                ));
                continue;
            }
        };

        match gateway.upload_attachment(jira_key, &filename, attachment.mime_type.as_deref(), bytes)
        {
            Ok(()) => {
                recorder.record_event(
                    Some(&task.id),
                    "jira.attachment.uploaded",
                    "succeeded",
                    attachment_uploaded_detail(
                        jira_key,
                        &filename,
                        &attachment.purpose,
                        managed_file.size_bytes,
                    ),
                )?;
                had_warning |= cleanup_attachment_local_bytes(
                    connection,
                    Some(app_data_dir),
                    task,
                    &attachment,
                    JIRA_ATTACHMENT_BYTES_CLEANED_STATUS,
                    result,
                )?;
            }
            Err(message) => {
                had_warning = true;
                recorder.record_event(
                    Some(&task.id),
                    "jira.attachment.upload_failed",
                    "failed",
                    attachment_error_detail(jira_key, &filename, &message),
                )?;
                result.messages.push(format!(
                    "{jira_key} attachment {filename} could not be uploaded: {message}"
                ));
            }
        }
    }

    Ok(had_warning)
}

fn cleanup_ai_only_attachments_after_created(
    connection: &Connection,
    app_data_dir: Option<&Path>,
    task: &LocalTask,
    result: &mut JiraCreateIssuesResult,
) -> Result<bool, String> {
    let attachments = task
        .attachments
        .iter()
        .filter(|attachment| attachment.purpose == "AI only" && attachment.restore_status.is_none())
        .cloned()
        .collect::<Vec<_>>();
    if attachments.is_empty() {
        return Ok(false);
    }

    let mut had_warning = false;
    for attachment in attachments {
        had_warning |= cleanup_attachment_local_bytes(
            connection,
            app_data_dir,
            task,
            &attachment,
            AI_ONLY_BYTES_CLEANED_STATUS,
            result,
        )?;
    }
    Ok(had_warning)
}

fn cleanup_attachment_local_bytes(
    connection: &Connection,
    app_data_dir: Option<&Path>,
    task: &LocalTask,
    attachment: &TaskAttachment,
    cleanup_status: &str,
    result: &mut JiraCreateIssuesResult,
) -> Result<bool, String> {
    let filename = sanitize_attachment_audit_name(&attachment.display_filename);
    let Some(app_data_dir) = app_data_dir else {
        result.messages.push(format!(
            "{} attachment {filename} local bytes could not be cleaned: app data directory was unavailable.",
            task.title
        ));
        return Ok(true);
    };

    match remove_managed_attachment_file(app_data_dir, &attachment.original_relative_path) {
        Ok(()) => {
            TaskRepository::new(connection)
                .mark_attachment_bytes_cleaned(&task.id, &attachment.id, cleanup_status)
                .map_err(db_error_message)?;
            Ok(false)
        }
        Err(error) => {
            result.messages.push(format!(
                "{} attachment {filename} local bytes could not be cleaned: {error}",
                task.title
            ));
            Ok(true)
        }
    }
}

fn format_byte_size_u64(size_bytes: u64) -> String {
    const KB: f64 = 1_024.0;
    const MB: f64 = KB * 1_024.0;
    const GB: f64 = MB * 1_024.0;
    let size = size_bytes as f64;
    if size >= GB {
        format!("{:.1} GB", size / GB)
    } else if size >= MB {
        format!("{:.1} MB", size / MB)
    } else if size >= KB {
        format!("{:.1} KB", size / KB)
    } else {
        format!("{} B", size_bytes)
    }
}

fn jira_parent_summary(task: &LocalTask) -> String {
    let title = task.title.trim();
    let area_display_name = catalog_area_display_name(&task.area).unwrap_or(task.area.trim());
    if area_display_name.is_empty() {
        return title.to_string();
    }

    let prefix = format!("[{area_display_name}]");
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

fn labels_for_area(area: &str) -> Vec<String> {
    [catalog_jira_label(area).unwrap_or(area)]
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
    use crate::models::{
        JiraCreateIssueTypeMetadata, JqlResult, NewTask, NewTaskAttachment, NewTray,
    };
    use crate::repositories::{TaskRepository, TrayRepository};
    use std::fs;
    use uuid::Uuid;

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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
            json!("[STT] [Bug] Demo Version 1")
        );
        assert_eq!(
            gateway.created_payloads[0]["fields"]["labels"],
            json!(["Bug"])
        );
        assert_eq!(
            gateway.created_payloads[1]["fields"]["parent"]["key"],
            json!("JTFTEST-10")
        );
        assert_eq!(
            gateway.created_payloads[1]["fields"]["labels"],
            json!(["Bug"])
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
    fn creates_epics_with_project_area_and_scope_targets() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Scoped sync".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Versión 1"), Some("Demos Versión 1"))
            .expect("tray scopes update");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Build demo flow".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "Transversal".to_string(),
                area: "Animacion".to_string(),
                title: "Coordinate animation demo".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec![
            "JTFTEST-100".to_string(),
            "JTFTEST-101".to_string(),
            "JTFTEST-102".to_string(),
            "JTFTEST-103".to_string(),
        ];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(
            gateway.created_payloads[0]["fields"]["summary"],
            json!("[STT] [Programacion] Demo Versión 1")
        );
        assert_eq!(
            gateway.created_payloads[2]["fields"]["summary"],
            json!("[Transversal] [Animacion] Demos Versión 1")
        );
    }

    #[test]
    fn uses_tbd_literal_for_normal_and_transversal_epics() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "TBD sync".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("[TBD]"), Some("Should not persist"))
            .expect("tray scopes update");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "PilotLab".to_string(),
                area: "UI".to_string(),
                title: "Park UI work".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "Transversal".to_string(),
                area: "Concept".to_string(),
                title: "Park concept work".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec![
            "JTFTEST-110".to_string(),
            "JTFTEST-111".to_string(),
            "JTFTEST-112".to_string(),
            "JTFTEST-113".to_string(),
        ];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(
            gateway.created_payloads[0]["fields"]["summary"],
            json!("[PilotLab] [UI] TBD")
        );
        assert_eq!(
            gateway.created_payloads[2]["fields"]["summary"],
            json!("[Transversal] [Concept] TBD")
        );
        let persisted_tray = tray_repository
            .find_by_id(&tray.id)
            .expect("tray reads")
            .expect("tray exists");
        assert_eq!(persisted_tray.epic_scope.as_deref(), Some("TBD"));
        assert_eq!(persisted_tray.transversal_epic_scope, None);
    }

    #[test]
    fn blocks_jira_creation_when_required_scope_is_missing() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Missing scope".to_string(),
            })
            .expect("tray creates");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Needs scope".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns blocked result");

        assert_eq!(result.status, "blocked");
        assert!(result
            .messages
            .iter()
            .any(|message| message.contains("missing Epic Scope")));
        assert!(gateway.created_payloads.is_empty());
    }

    #[test]
    fn blocks_only_transversal_groups_when_transversal_scope_is_missing() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Missing transversal".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Versión 1"), None)
            .expect("tray scopes update");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Normal task".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "Transversal".to_string(),
                area: "Animacion".to_string(),
                title: "Transversal task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns blocked result");

        assert_eq!(result.status, "blocked");
        assert_eq!(
            result
                .messages
                .iter()
                .filter(|message| message.contains("missing Epic Scope"))
                .count(),
            1
        );
        assert!(result
            .messages
            .iter()
            .any(|message| message.contains("Transversal task")));
        assert!(gateway.created_payloads.is_empty());
    }

    #[test]
    fn resolves_legacy_epic_without_creating_duplicate() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Legacy epic".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Versión 1"), None)
            .expect("tray scopes update");
        task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Use legacy epic".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.search_results = vec![epic_search_result("JTFTEST-90", "[STT] Programacion")];
        gateway.created_keys = vec!["JTFTEST-91".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(gateway.created_payloads.len(), 1);
        assert_eq!(
            gateway.created_payloads[0]["fields"]["parent"]["key"],
            json!("JTFTEST-90")
        );
        assert!(gateway.search_jqls[0].contains("[STT] [Programacion] Demo Versión 1"));
        assert!(gateway.search_jqls[0].contains("[STT] Programacion"));
    }

    #[test]
    fn uploads_only_jira_eligible_attachments_after_issue_creation() {
        let connection = open_in_memory_database().expect("database opens");
        let app_data_dir = std::env::temp_dir().join(format!(
            "jira-task-forge-sync-attachments-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(app_data_dir.join("attachments").join("task"))
            .expect("app data creates");
        fs::write(
            app_data_dir
                .join("attachments")
                .join("task")
                .join("jira-ready.png"),
            b"jira ready bytes",
        )
        .expect("jira attachment writes");
        fs::write(
            app_data_dir
                .join("attachments")
                .join("task")
                .join("ai-only.png"),
            b"ai only bytes",
        )
        .expect("ai attachment writes");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Attachment sync".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id.clone(),
                display_filename: "jira-ready.png".to_string(),
                mime_type: Some("image/png".to_string()),
                purpose: "AI + Jira attachment".to_string(),
                original_size_bytes: 16,
                original_relative_path: "attachments/task/jira-ready.png".to_string(),
            })
            .expect("jira attachment creates");
        task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id.clone(),
                display_filename: "ai-only.png".to_string(),
                mime_type: Some("image/png".to_string()),
                purpose: "AI only".to_string(),
                original_size_bytes: 13,
                original_relative_path: "attachments/task/ai-only.png".to_string(),
            })
            .expect("ai attachment creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-20".to_string(), "JTFTEST-21".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string())
            .with_app_data_dir(app_data_dir.clone());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(gateway.uploaded_attachments.len(), 1);
        assert_eq!(gateway.uploaded_attachments[0].0, "JTFTEST-21");
        assert_eq!(gateway.uploaded_attachments[0].1, "jira-ready.png");
        assert_eq!(
            gateway.uploaded_attachments[0].2.as_deref(),
            Some("image/png")
        );
        assert_eq!(gateway.uploaded_attachments[0].3, b"jira ready bytes");
        let upload_event_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sync_audit_events WHERE event_type = 'jira.attachment.uploaded' AND outcome = 'succeeded'",
                [],
                |row| row.get(0),
            )
            .expect("upload event count reads");
        assert_eq!(upload_event_count, 1);
        assert!(
            !app_data_dir
                .join("attachments")
                .join("task")
                .join("jira-ready.png")
                .exists(),
            "Jira-ready bytes are removed after upload"
        );
        assert!(
            !app_data_dir
                .join("attachments")
                .join("task")
                .join("ai-only.png")
                .exists(),
            "AI-only bytes are removed after the Local Task is Created"
        );
        let persisted_task = task_repository
            .find_by_id(&task.id)
            .expect("task reads")
            .expect("task exists");
        assert_eq!(persisted_task.sync_status, "Created");
        assert_eq!(persisted_task.jira_key.as_deref(), Some("JTFTEST-21"));
        assert_eq!(persisted_task.attachments.len(), 2);
        let jira_attachment = persisted_task
            .attachments
            .iter()
            .find(|attachment| attachment.display_filename == "jira-ready.png")
            .expect("jira metadata remains");
        assert_eq!(jira_attachment.mime_type.as_deref(), Some("image/png"));
        assert_eq!(jira_attachment.original_size_bytes, 16);
        assert_eq!(jira_attachment.purpose, "AI + Jira attachment");
        assert_eq!(
            jira_attachment.restore_status.as_deref(),
            Some(JIRA_ATTACHMENT_BYTES_CLEANED_STATUS)
        );
        let ai_attachment = persisted_task
            .attachments
            .iter()
            .find(|attachment| attachment.display_filename == "ai-only.png")
            .expect("ai metadata remains");
        assert_eq!(ai_attachment.original_size_bytes, 13);
        assert_eq!(ai_attachment.purpose, "AI only");
        assert_eq!(
            ai_attachment.restore_status.as_deref(),
            Some(AI_ONLY_BYTES_CLEANED_STATUS)
        );

        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn marks_jira_creation_partial_when_attachment_upload_fails() {
        let connection = open_in_memory_database().expect("database opens");
        let app_data_dir = std::env::temp_dir().join(format!(
            "jira-task-forge-sync-attachment-failure-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(app_data_dir.join("attachments").join("task"))
            .expect("app data creates");
        fs::write(
            app_data_dir
                .join("attachments")
                .join("task")
                .join("jira-ready.png"),
            b"jira ready bytes",
        )
        .expect("jira attachment writes");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Attachment sync failure".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id.clone(),
                display_filename: "jira-ready.png".to_string(),
                mime_type: Some("image/png".to_string()),
                purpose: "Jira attachment".to_string(),
                original_size_bytes: 16,
                original_relative_path: "attachments/task/jira-ready.png".to_string(),
            })
            .expect("jira attachment creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-22".to_string(), "JTFTEST-23".to_string()];
        gateway.attachment_failures = vec!["upload denied".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string())
            .with_app_data_dir(app_data_dir.clone());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns partial result");

        assert_eq!(result.status, "partial");
        assert_eq!(result.created_issue_count, 1);
        assert_eq!(result.failed_issue_count, 0);
        assert!(result
            .messages
            .iter()
            .any(|message| message.contains("attachment")));
        let upload_failure_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sync_audit_events WHERE event_type = 'jira.attachment.upload_failed' AND outcome = 'failed'",
                [],
                |row| row.get(0),
            )
            .expect("upload event count reads");
        assert_eq!(upload_failure_count, 1);

        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn blocks_oversized_jira_ready_attachments_before_creating_issues() {
        let connection = open_in_memory_database().expect("database opens");
        let app_data_dir =
            std::env::temp_dir().join(format!("jira-task-forge-sync-oversized-{}", Uuid::new_v4()));
        fs::create_dir_all(app_data_dir.join("attachments").join("task"))
            .expect("app data creates");
        fs::write(
            app_data_dir
                .join("attachments")
                .join("task")
                .join("large.csv"),
            b"too large",
        )
        .expect("attachment writes");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Oversized attachment".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Block large upload".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id.clone(),
                display_filename: "large.csv".to_string(),
                mime_type: Some("text/csv".to_string()),
                purpose: "Jira attachment".to_string(),
                original_size_bytes: 9,
                original_relative_path: "attachments/task/large.csv".to_string(),
            })
            .expect("attachment creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.attachment_settings = Ok(JiraAttachmentSettings {
            enabled: true,
            upload_limit: 4,
        });

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string())
            .with_app_data_dir(app_data_dir.clone());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync blocks cleanly");

        assert_eq!(result.status, "blocked");
        assert_eq!(gateway.attachment_settings_calls, 1);
        assert!(gateway.created_payloads.is_empty());
        assert!(gateway.uploaded_attachments.is_empty());
        assert!(result
            .messages
            .iter()
            .any(|message| message.contains("large.csv") && message.contains("Jira allows")));

        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn blocks_unsafe_attachment_paths_before_jira_writes() {
        let connection = open_in_memory_database().expect("database opens");
        let app_data_dir = std::env::temp_dir().join(format!(
            "jira-task-forge-sync-unsafe-path-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&app_data_dir).expect("app data creates");
        let sentinel_path = app_data_dir.join("sentinel.txt");
        fs::write(&sentinel_path, b"do not read").expect("sentinel writes");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Unsafe attachment".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Block unsafe attachment".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        connection
            .execute(
                "
                INSERT INTO attachments (
                    id, task_id, display_filename, mime_type, purpose, original_size_bytes,
                    original_relative_path, file_hash, restore_status, created_at, updated_at
                )
                VALUES ('attachment-unsafe', ?1, 'sentinel.txt', 'text/plain', 'Jira attachment',
                        11, '../sentinel.txt', NULL, NULL, '2026-05-28T00:00:00Z', '2026-05-28T00:00:00Z')
                ",
                [&task.id],
            )
            .expect("unsafe metadata inserts");
        let mut gateway = FakeJiraGateway::new();

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string())
            .with_app_data_dir(app_data_dir.clone());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync blocks cleanly");

        assert_eq!(result.status, "blocked");
        assert!(gateway.created_payloads.is_empty());
        assert!(gateway.uploaded_attachments.is_empty());
        assert_eq!(
            fs::read(&sentinel_path).expect("sentinel reads"),
            b"do not read"
        );
        assert!(result
            .messages
            .iter()
            .any(|message| message.contains("could not be validated")));

        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn does_not_fetch_attachment_settings_for_ai_only_attachments() {
        let connection = open_in_memory_database().expect("database opens");
        let app_data_dir =
            std::env::temp_dir().join(format!("jira-task-forge-sync-ai-only-{}", Uuid::new_v4()));
        fs::create_dir_all(app_data_dir.join("attachments").join("task"))
            .expect("app data creates");
        fs::write(
            app_data_dir
                .join("attachments")
                .join("task")
                .join("context.txt"),
            b"ai only context",
        )
        .expect("attachment writes");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "AI-only attachment".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Create without upload".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id,
                display_filename: "context.txt".to_string(),
                mime_type: Some("text/plain".to_string()),
                purpose: "AI only".to_string(),
                original_size_bytes: 15,
                original_relative_path: "attachments/task/context.txt".to_string(),
            })
            .expect("attachment creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-30".to_string(), "JTFTEST-31".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string())
            .with_app_data_dir(app_data_dir.clone());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(gateway.attachment_settings_calls, 0);
        assert!(gateway.uploaded_attachments.is_empty());
        assert!(
            !app_data_dir
                .join("attachments")
                .join("task")
                .join("context.txt")
                .exists(),
            "AI-only bytes are removed once the task is Created"
        );
        let persisted_task = task_repository
            .find_by_id(
                result.created_issues[0]
                    .task_id
                    .as_deref()
                    .expect("created task id"),
            )
            .expect("task reads")
            .expect("task exists");
        assert_eq!(
            persisted_task.attachments[0].restore_status.as_deref(),
            Some(AI_ONLY_BYTES_CLEANED_STATUS)
        );

        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn missing_ai_only_attachment_cleanup_after_created_is_idempotent() {
        let connection = open_in_memory_database().expect("database opens");
        let app_data_dir = std::env::temp_dir().join(format!(
            "jira-task-forge-sync-ai-only-missing-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(app_data_dir.join("attachments").join("task"))
            .expect("app data creates");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "AI-only missing attachment".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Create after missing local context".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id.clone(),
                display_filename: "missing-context.txt".to_string(),
                mime_type: Some("text/plain".to_string()),
                purpose: "AI only".to_string(),
                original_size_bytes: 15,
                original_relative_path: "attachments/task/missing-context.txt".to_string(),
            })
            .expect("attachment creates");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-32".to_string(), "JTFTEST-33".to_string()];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string())
            .with_app_data_dir(app_data_dir.clone());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issue_count, 1);
        let persisted_task = task_repository
            .find_by_id(&task.id)
            .expect("task reads")
            .expect("task exists");
        assert_eq!(persisted_task.sync_status, "Created");
        assert_eq!(
            persisted_task.attachments[0].restore_status.as_deref(),
            Some(AI_ONLY_BYTES_CLEANED_STATUS)
        );

        let _ = fs::remove_dir_all(&app_data_dir);
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
            .create_parent_issues_from_tray_with_progress(&tray.id, true, false, true, |_| {})
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
            issue_relationships: Vec::new(),
            attachments: Vec::new(),
            task_order: 0,
            created_at: "2026-05-24T00:00:00Z".to_string(),
            updated_at: "2026-05-24T00:00:00Z".to_string(),
        };

        assert_eq!(jira_parent_summary(&task), "[Bug] Fix timer drift");
    }

    #[test]
    fn uses_display_area_for_summary_and_jira_label_for_labels() {
        let task = LocalTask {
            id: "task-1".to_string(),
            tray_id: "tray-1".to_string(),
            project: "DTS".to_string(),
            area: "Selección Recurso".to_string(),
            title: "Elegir asset base".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Story".to_string(),
            sync_status: "Pending".to_string(),
            description_status: "Missing".to_string(),
            description: None,
            content_language: "Spanish".to_string(),
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            issue_relationships: Vec::new(),
            attachments: Vec::new(),
            task_order: 0,
            created_at: "2026-05-24T00:00:00Z".to_string(),
            updated_at: "2026-05-24T00:00:00Z".to_string(),
        };

        assert_eq!(
            jira_parent_summary(&task),
            "[Selección Recurso] Elegir asset base"
        );
        assert_eq!(
            labels_for_area(&task.area),
            vec!["Selección-Recurso".to_string()]
        );
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
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

    #[test]
    fn recovers_failed_parent_issue_when_remote_marker_is_found() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Remote marker recovery".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Recover ambiguous parent".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .mark_jira_failed(&task.id)
            .expect("task marked failed");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-80".to_string()];
        gateway.remote_marker_results = vec![Ok(Some(JiraRemoteMarkerIssue {
            key: "JTFTEST-81".to_string(),
        }))];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "succeeded");
        assert_eq!(result.created_issue_count, 0);
        assert_eq!(result.skipped_issue_count, 1);
        assert_eq!(gateway.created_payloads.len(), 1);
        assert_eq!(gateway.remote_marker_lookups.len(), 1);
        assert_eq!(gateway.remote_marker_lookups[0].0, "JTFTEST");
        assert_eq!(gateway.remote_marker_lookups[0].1, "Historia");
        assert_eq!(
            gateway.remote_marker_lookups[0].2,
            "[Bug] Recover ambiguous parent"
        );
        assert_eq!(gateway.remote_marker_lookups[0].3, task.id);
        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.title == "Recover ambiguous parent")
            .expect("task remains");
        assert_eq!(persisted_task.sync_status, "Created");
        assert_eq!(persisted_task.jira_key.as_deref(), Some("JTFTEST-81"));
        assert_eq!(persisted_task.epic_key.as_deref(), Some("JTFTEST-80"));
        let recovery_event_detail: String = connection
            .query_row(
                "
                SELECT detail_json FROM sync_audit_events
                WHERE event_type = 'jira.issue.remote_marker_recovered'
                    AND outcome = 'succeeded'
                ",
                [],
                |row| row.get(0),
            )
            .expect("recovery event detail reads");
        assert!(recovery_event_detail.contains("JTFTEST-81"));
        assert!(recovery_event_detail.contains("remote-correlation-marker"));
    }

    #[test]
    fn blocks_failed_parent_issue_without_create_when_remote_marker_is_not_found() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "No marker retry".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Create after marker miss".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .mark_jira_failed(&task.id)
            .expect("task marked failed");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-82".to_string()];
        gateway.remote_marker_results = vec![Ok(None)];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync succeeds");

        assert_eq!(result.status, "failed");
        assert_eq!(result.created_issue_count, 0);
        assert_eq!(result.failed_issue_count, 1);
        assert_eq!(gateway.remote_marker_lookups.len(), 1);
        assert_eq!(gateway.remote_marker_lookups[0].1, "Historia");
        assert_eq!(
            gateway.remote_marker_lookups[0].2,
            "[Bug] Create after marker miss"
        );
        assert_eq!(gateway.created_payloads.len(), 1);
        assert!(result.failed_tasks[0]
            .message
            .contains("Review the task manually before retrying"));
        let persisted_task = TaskRepository::new(&connection)
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .find(|candidate| candidate.id == task.id)
            .expect("task remains");
        assert_eq!(persisted_task.sync_status, "Failed");
        assert_eq!(persisted_task.jira_key.as_deref(), None);
    }

    #[test]
    fn fails_failed_parent_issue_without_create_when_remote_marker_lookup_fails() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Marker lookup failure".to_string(),
            })
            .expect("tray creates");
        tray_repository
            .update_epic_scopes(&tray.id, Some("Demo Version 1"), Some("Demos Version 1"))
            .expect("tray scopes update");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Do not blindly retry".to_string(),
                priority: "Highest".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        task_repository
            .mark_jira_failed(&task.id)
            .expect("task marked failed");
        let mut gateway = FakeJiraGateway::new();
        gateway.created_keys = vec!["JTFTEST-84".to_string()];
        gateway.remote_marker_results = vec![
            Err("lookup timed out with Basic first-secret".to_string()),
            Err("lookup timed out with Basic second-secret".to_string()),
        ];

        let mut runner = JiraSyncRunner::new(&connection, &mut gateway, "JTFTEST".to_string());
        let result = runner
            .create_parent_issues_from_tray(&tray.id, true)
            .expect("sync returns failure result");

        assert_eq!(result.status, "failed");
        assert_eq!(result.created_issue_count, 0);
        assert_eq!(result.failed_issue_count, 1);
        assert_eq!(gateway.remote_marker_lookups.len(), 2);
        assert_eq!(gateway.created_payloads.len(), 1);
        assert!(result.failed_tasks[0]
            .message
            .contains("Could not confirm whether this failed task already exists"));
        let failure_event_detail: String = connection
            .query_row(
                "
                SELECT detail_json FROM sync_audit_events
                WHERE event_type = 'jira.issue.remote_marker_lookup'
                    AND outcome = 'failed'
                ",
                [],
                |row| row.get(0),
            )
            .expect("failure event detail reads");
        assert!(failure_event_detail.contains("Basic <redacted>"));
        assert!(!failure_event_detail.contains("second-secret"));
    }

    struct FakeJiraGateway {
        metadata: JiraCreateMetadata,
        attachment_settings: Result<JiraAttachmentSettings, String>,
        attachment_settings_calls: usize,
        created_payloads: Vec<Value>,
        updated_payloads: Vec<(String, Value)>,
        uploaded_attachments: Vec<(String, String, Option<String>, Vec<u8>)>,
        search_results: Vec<JqlResult>,
        search_jqls: Vec<String>,
        created_keys: Vec<String>,
        create_failures: Vec<String>,
        update_failures: Vec<String>,
        attachment_failures: Vec<String>,
        remote_marker_results: Vec<Result<Option<JiraRemoteMarkerIssue>, String>>,
        remote_marker_lookups: Vec<(String, String, String, String)>,
    }

    impl FakeJiraGateway {
        fn new() -> Self {
            Self {
                metadata: test_metadata("JTFTEST"),
                attachment_settings: Ok(JiraAttachmentSettings {
                    enabled: true,
                    upload_limit: JIRA_CLOUD_FALLBACK_ATTACHMENT_UPLOAD_LIMIT_BYTES as i64,
                }),
                attachment_settings_calls: 0,
                created_payloads: Vec::new(),
                updated_payloads: Vec::new(),
                uploaded_attachments: Vec::new(),
                search_results: Vec::new(),
                search_jqls: Vec::new(),
                created_keys: Vec::new(),
                create_failures: Vec::new(),
                update_failures: Vec::new(),
                attachment_failures: Vec::new(),
                remote_marker_results: Vec::new(),
                remote_marker_lookups: Vec::new(),
            }
        }
    }

    impl JiraIssueGateway for FakeJiraGateway {
        fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String> {
            let mut metadata = self.metadata.clone();
            metadata.project_key = project_key.to_string();
            Ok(metadata)
        }

        fn attachment_settings(&mut self) -> Result<JiraAttachmentSettings, String> {
            self.attachment_settings_calls += 1;
            self.attachment_settings.clone()
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
            jql: &str,
            _max_results: usize,
        ) -> Result<JqlSearchResponse, String> {
            self.search_jqls.push(jql.to_string());
            Ok(JqlSearchResponse {
                results: self.search_results.clone(),
                is_last: true,
                next_page_token: None,
                warning_messages: Vec::new(),
            })
        }

        fn find_parent_issue_by_remote_marker(
            &mut self,
            project_key: &str,
            issue_type: &str,
            summary: &str,
            local_task_id: &str,
        ) -> Result<Option<JiraRemoteMarkerIssue>, String> {
            self.remote_marker_lookups.push((
                project_key.to_string(),
                issue_type.to_string(),
                summary.to_string(),
                local_task_id.to_string(),
            ));
            if self.remote_marker_results.is_empty() {
                return Ok(None);
            }

            self.remote_marker_results.remove(0)
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

        fn upload_attachment(
            &mut self,
            key: &str,
            filename: &str,
            mime_type: Option<&str>,
            bytes: Vec<u8>,
        ) -> Result<(), String> {
            if !self.attachment_failures.is_empty() {
                return Err(self.attachment_failures.remove(0));
            }
            self.uploaded_attachments.push((
                key.to_string(),
                filename.to_string(),
                mime_type.map(str::to_string),
                bytes,
            ));
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

    fn epic_search_result(key: &str, summary: &str) -> JqlResult {
        JqlResult {
            key: key.to_string(),
            project: "JTFTEST".to_string(),
            issue_type: "Epic".to_string(),
            priority: "Medium".to_string(),
            status: "To Do".to_string(),
            summary: summary.to_string(),
            assignee: "Unassigned".to_string(),
        }
    }
}
