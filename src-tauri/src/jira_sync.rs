use std::collections::{BTreeMap, HashMap};

use rusqlite::Connection;
use serde_json::{json, Value};

use crate::db::DbError;
use crate::integrations::jira::JiraClient;
use crate::models::{
    JiraCreateAllowedValue, JiraCreateFieldMetadata, JiraCreateIssueResponse,
    JiraCreateIssueTypeMetadata, JiraCreateIssuesResult, JiraCreateMetadata,
    JiraCreatedIssueResult, JiraFailedTaskResult, JiraMyself, JqlSearchResponse, LocalTask,
};
use crate::repositories::{SyncRepository, TaskRepository, TrayRepository};

const JIRA_TASK_FORGE_LABEL: &str = "jira-task-forge";
const JIRA_TASK_FORGE_PROPERTY_KEY: &str = "jira-task-forge-sync";
const JIRA_PROVIDER_OPERATION: &str = "create-parent-issues";

pub trait JiraIssueGateway {
    fn create_metadata(&mut self, project_key: &str) -> Result<JiraCreateMetadata, String>;
    fn current_user(&mut self) -> Result<JiraMyself, String>;
    fn search_jql(&mut self, jql: &str, max_results: usize) -> Result<JqlSearchResponse, String>;
    fn create_issue(&mut self, payload: Value) -> Result<JiraCreateIssueResponse, String>;
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
                }),
            )
            .map_err(db_error_message)?;

        let parent_tasks = tasks
            .iter()
            .filter(|task| task.sync_status != "Created" && task.issue_type != "Sub-task")
            .cloned()
            .collect::<Vec<_>>();
        result.skipped_issue_count = tasks.len().saturating_sub(parent_tasks.len());

        let local_blockers =
            self.validate_local_preflight(&parent_tasks, allow_missing_descriptions);
        if !local_blockers.is_empty() {
            return self.finish_blocked(
                sync_repository,
                &sync_attempt_id,
                tray_id,
                local_blockers,
                result,
            );
        }

        let metadata = match self.gateway.create_metadata(&self.creation_project_key) {
            Ok(metadata) => metadata,
            Err(message) => {
                return self.finish_blocked(
                    sync_repository,
                    &sync_attempt_id,
                    tray_id,
                    vec![format!("Could not read Jira create metadata: {message}")],
                    result,
                )
            }
        };
        let plan = match ResolvedCreateMetadata::resolve(&metadata, &parent_tasks) {
            Ok(plan) => plan,
            Err(messages) => {
                return self.finish_blocked(
                    sync_repository,
                    &sync_attempt_id,
                    tray_id,
                    messages,
                    result,
                )
            }
        };

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
                    "taskCount": parent_tasks.len(),
                }),
            )
            .map_err(db_error_message)?;

        let reporter_account_id = if plan.requires_reporter() {
            match self.gateway.current_user() {
                Ok(user) => match user.account_id {
                    Some(account_id) if !account_id.trim().is_empty() => Some(account_id),
                    _ => {
                        return self.finish_blocked(
                            sync_repository,
                            &sync_attempt_id,
                            tray_id,
                            vec![
                                "Jira create metadata requires Reporter, but the current Jira account id could not be resolved."
                                    .to_string(),
                            ],
                            result,
                        )
                    }
                },
                Err(message) => {
                    return self.finish_blocked(
                        sync_repository,
                        &sync_attempt_id,
                        tray_id,
                        vec![format!(
                            "Jira create metadata requires Reporter, but the current Jira user could not be read: {message}"
                        )],
                        result,
                    )
                }
            }
        } else {
            None
        };

        let groups = group_tasks_by_project_area(parent_tasks);
        for ((local_project, area), group_tasks) in groups {
            let epic_summary = format!("[{local_project}] {area}");
            let epic_key = match resolve_or_create_epic(
                self.gateway,
                &sync_repository,
                &sync_attempt_id,
                tray_id,
                &plan,
                &self.creation_project_key,
                &local_project,
                &area,
                &epic_summary,
                reporter_account_id.as_deref(),
            ) {
                Ok(key) => key,
                Err(message) => {
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
                    }
                    continue;
                }
            };

            for task in group_tasks {
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
                        result.created_issue_count += 1;
                        result.created_issues.push(JiraCreatedIssueResult {
                            task_id: Some(task.id),
                            key: created_issue.key,
                            url: issue_url,
                            issue_type: task.issue_type,
                            summary: task.title,
                            epic_key: Some(epic_key.clone()),
                        });
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
                    }
                }
            }
        }

        let final_status = if result.failed_issue_count == 0 {
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
        Ok(result)
    }

    fn validate_local_preflight(
        &self,
        parent_tasks: &[LocalTask],
        allow_missing_descriptions: bool,
    ) -> Vec<String> {
        let mut messages = Vec::new();
        if self.creation_project_key.is_empty() {
            messages.push("Jira creation project key is required.".to_string());
        }
        if parent_tasks.is_empty() {
            messages.push("There are no pending parent Story or Bug tasks to create.".to_string());
        }

        for task in parent_tasks {
            if task.project.trim().is_empty() {
                messages.push(format!("{} is missing a local project.", task.title));
            }
            if task.area.trim().is_empty() {
                messages.push(format!("{} is missing an area.", task.title));
            }
            if task.title.trim().is_empty() {
                messages.push("A task is missing a title.".to_string());
            }
            if task.description_status == "Missing" && !allow_missing_descriptions {
                messages.push(format!(
                    "{} is missing a description. Confirm missing descriptions before creating it in Jira.",
                    task.title
                ));
            }
            if task.issue_type != "Story" && task.issue_type != "Bug" {
                messages.push(format!(
                    "{} has unsupported issue type {} for this Jira write slice.",
                    task.title, task.issue_type
                ));
            }
        }

        messages
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
                json!({ "messages": result.messages.clone() }),
            )
            .map_err(db_error_message)?;
        sync_repository
            .finish_attempt(sync_attempt_id, "failed")
            .map_err(db_error_message)?;
        Ok(result)
    }
}

#[derive(Debug, Clone)]
struct ResolvedCreateMetadata {
    epic: IssueTypePlan,
    story: Option<IssueTypePlan>,
    bug: Option<IssueTypePlan>,
}

impl ResolvedCreateMetadata {
    fn resolve(
        metadata: &JiraCreateMetadata,
        parent_tasks: &[LocalTask],
    ) -> Result<Self, Vec<String>> {
        let mut messages = Vec::new();
        let epic = find_issue_type(&metadata.issue_types, IssueTypeRole::Epic)
            .map(|issue_type| IssueTypePlan::resolve(issue_type, IssueTypeRole::Epic));
        let story = if parent_tasks.iter().any(|task| task.issue_type == "Story") {
            find_issue_type(&metadata.issue_types, IssueTypeRole::Story)
                .map(|issue_type| IssueTypePlan::resolve(issue_type, IssueTypeRole::Story))
        } else {
            None
        };
        let bug = if parent_tasks.iter().any(|task| task.issue_type == "Bug") {
            find_issue_type(&metadata.issue_types, IssueTypeRole::Bug)
                .map(|issue_type| IssueTypePlan::resolve(issue_type, IssueTypeRole::Bug))
        } else {
            None
        };

        let Some(epic) = epic else {
            messages.push("Jira create metadata does not include an Epic issue type.".to_string());
            return Err(messages);
        };
        if parent_tasks.iter().any(|task| task.issue_type == "Story") && story.is_none() {
            messages.push("Jira create metadata does not include a Story issue type.".to_string());
        }
        if parent_tasks.iter().any(|task| task.issue_type == "Bug") && bug.is_none() {
            messages.push("Jira create metadata does not include a Bug issue type.".to_string());
        }

        let mut plans = vec![epic.clone()];
        if let Some(story) = story.clone() {
            plans.push(story);
        }
        if let Some(bug) = bug.clone() {
            plans.push(bug);
        }
        for plan in &plans {
            messages.extend(plan.validation_messages());
        }

        if messages.is_empty() {
            Ok(Self { epic, story, bug })
        } else {
            Err(messages)
        }
    }

    fn issue_type_for_local(&self, local_issue_type: &str) -> Option<&IssueTypePlan> {
        match local_issue_type {
            "Story" => self.story.as_ref(),
            "Bug" => self.bug.as_ref(),
            _ => None,
        }
    }

    fn issue_type_names(&self) -> Vec<String> {
        let mut names = vec![self.epic.name.clone()];
        if let Some(story) = &self.story {
            names.push(story.name.clone());
        }
        if let Some(bug) = &self.bug {
            names.push(bug.name.clone());
        }
        names
    }

    fn requires_reporter(&self) -> bool {
        self.epic.requires_field("reporter")
            || self
                .story
                .as_ref()
                .is_some_and(|story| story.requires_field("reporter"))
            || self
                .bug
                .as_ref()
                .is_some_and(|bug| bug.requires_field("reporter"))
    }
}

#[derive(Debug, Clone)]
struct IssueTypePlan {
    id: String,
    name: String,
    role: IssueTypeRole,
    fields: HashMap<String, JiraCreateFieldMetadata>,
    epic_link_field: Option<EpicLinkFieldPlan>,
    epic_name_field: Option<String>,
}

impl IssueTypePlan {
    fn resolve(metadata: &JiraCreateIssueTypeMetadata, role: IssueTypeRole) -> Self {
        let mut fields = HashMap::new();
        for field in &metadata.fields {
            fields.insert(field.key.clone(), field.clone());
        }

        let epic_link_field = if matches!(role, IssueTypeRole::Story | IssueTypeRole::Bug) {
            find_epic_link_field(&metadata.fields)
        } else {
            None
        };
        let epic_name_field = if matches!(role, IssueTypeRole::Epic) {
            metadata
                .fields
                .iter()
                .find(|field| is_epic_name_field(field))
                .map(|field| field.key.clone())
        } else {
            None
        };

        Self {
            id: metadata.id.clone(),
            name: metadata.name.clone(),
            role,
            fields,
            epic_link_field,
            epic_name_field,
        }
    }

    fn field(&self, key: &str) -> Option<&JiraCreateFieldMetadata> {
        self.fields.get(key)
    }

    fn requires_field(&self, key: &str) -> bool {
        self.fields.get(key).is_some_and(|field| field.required)
    }

    fn validation_messages(&self) -> Vec<String> {
        let mut messages = Vec::new();
        for key in ["summary", "issuetype", "project", "labels"] {
            if !self.fields.contains_key(key) {
                messages.push(format!(
                    "Jira issue type {} is missing create field {key}.",
                    self.name
                ));
            }
        }
        if matches!(self.role, IssueTypeRole::Story | IssueTypeRole::Bug)
            && self.epic_link_field.is_none()
        {
            messages.push(format!(
                "Jira issue type {} does not expose parent or Epic Link metadata.",
                self.name
            ));
        }

        for field in self.fields.values().filter(|field| field.required) {
            if self.can_populate_required_field(field) {
                continue;
            }
            messages.push(format!(
                "Jira issue type {} requires field {} that Jira Task Forge cannot populate yet.",
                self.name, field.name
            ));
        }

        messages
    }

    fn can_populate_required_field(&self, field: &JiraCreateFieldMetadata) -> bool {
        match field.key.as_str() {
            "summary" | "issuetype" | "project" | "priority" | "labels" | "reporter" => true,
            "parent" => matches!(self.role, IssueTypeRole::Story | IssueTypeRole::Bug),
            "description" => false,
            _ if matches!(self.role, IssueTypeRole::Epic) && is_epic_name_field(field) => true,
            _ if matches!(self.role, IssueTypeRole::Story | IssueTypeRole::Bug)
                && self
                    .epic_link_field
                    .as_ref()
                    .is_some_and(|epic_field| epic_field.key == field.key) =>
            {
                true
            }
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IssueTypeRole {
    Epic,
    Story,
    Bug,
}

#[derive(Debug, Clone)]
struct EpicLinkFieldPlan {
    key: String,
    style: EpicLinkStyle,
}

#[derive(Debug, Clone)]
enum EpicLinkStyle {
    Parent,
    EpicLink,
}

fn find_issue_type(
    issue_types: &[JiraCreateIssueTypeMetadata],
    role: IssueTypeRole,
) -> Option<&JiraCreateIssueTypeMetadata> {
    issue_types
        .iter()
        .filter(|issue_type| {
            if matches!(
                role,
                IssueTypeRole::Epic | IssueTypeRole::Story | IssueTypeRole::Bug
            ) {
                !issue_type.subtask
            } else {
                true
            }
        })
        .find(|issue_type| issue_type_name_matches(&issue_type.name, role))
}

fn issue_type_name_matches(name: &str, role: IssueTypeRole) -> bool {
    let normalized = normalize_for_matching(name);
    match role {
        IssueTypeRole::Epic => matches!(normalized.as_str(), "epic" | "epica"),
        IssueTypeRole::Story => matches!(normalized.as_str(), "story" | "historia" | "user story"),
        IssueTypeRole::Bug => matches!(
            normalized.as_str(),
            "bug" | "error" | "defecto" | "incidencia"
        ),
    }
}

fn find_epic_link_field(fields: &[JiraCreateFieldMetadata]) -> Option<EpicLinkFieldPlan> {
    if fields.iter().any(|field| field.key == "parent") {
        return Some(EpicLinkFieldPlan {
            key: "parent".to_string(),
            style: EpicLinkStyle::Parent,
        });
    }

    fields
        .iter()
        .find(|field| {
            let normalized = normalize_for_matching(&field.name);
            normalized == "epic link" || normalized == "epic" || normalized == "parent"
        })
        .map(|field| EpicLinkFieldPlan {
            key: field.key.clone(),
            style: EpicLinkStyle::EpicLink,
        })
}

fn is_epic_name_field(field: &JiraCreateFieldMetadata) -> bool {
    let normalized = normalize_for_matching(&field.name);
    normalized == "epic name" || normalized == "nombre de epica"
}

fn resolve_or_create_epic<Gateway>(
    gateway: &mut Gateway,
    sync_repository: &SyncRepository<'_>,
    sync_attempt_id: &str,
    tray_id: &str,
    plan: &ResolvedCreateMetadata,
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
    plan: &ResolvedCreateMetadata,
    jira_project_key: &str,
    local_project: &str,
    area: &str,
    summary: &str,
    sync_attempt_id: &str,
    reporter_account_id: Option<&str>,
) -> Value {
    let mut fields = json!({
        "project": { "key": jira_project_key },
        "issuetype": { "id": plan.epic.id },
        "summary": summary,
        "labels": labels_for(local_project, area),
    });
    if plan.epic.field("priority").is_some() {
        fields["priority"] = priority_value(plan.epic.field("priority"), "Medium");
    }
    if let Some(account_id) = reporter_account_id {
        fields["reporter"] = json!({ "accountId": account_id });
    }
    if let Some(epic_name_field) = &plan.epic.epic_name_field {
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
        "summary": task.title,
        "labels": labels_for(&task.project, &task.area),
    });
    if issue_type.field("priority").is_some() {
        fields["priority"] = priority_value(issue_type.field("priority"), &task.priority);
    }
    if let Some(account_id) = reporter_account_id {
        fields["reporter"] = json!({ "accountId": account_id });
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

fn group_tasks_by_project_area(
    tasks: Vec<LocalTask>,
) -> BTreeMap<(String, String), Vec<LocalTask>> {
    let mut groups = BTreeMap::new();
    for task in tasks {
        groups
            .entry((
                task.project.trim().to_string(),
                task.area.trim().to_string(),
            ))
            .or_insert_with(Vec::new)
            .push(task);
    }
    groups
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
            json!({ "message": message }),
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

fn normalize_for_matching(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| match character {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            other => other,
        })
        .collect()
}

fn db_error_message(error: DbError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_database;
    use crate::models::{JqlResult, NewTask, NewTray};
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
            gateway.created_payloads[1]["properties"][0]["value"]["localTaskId"],
            json!(task.id)
        );
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
        created_keys: Vec<String>,
        create_failures: Vec<String>,
    }

    impl FakeJiraGateway {
        fn new() -> Self {
            Self {
                metadata: test_metadata("JTFTEST"),
                created_payloads: Vec::new(),
                created_keys: Vec::new(),
                create_failures: Vec::new(),
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
