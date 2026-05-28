use std::collections::{BTreeMap, BTreeSet, HashMap};

use crate::models::{
    JiraCreateFieldMetadata, JiraCreateIssueTypeMetadata, JiraCreateMetadata, LocalTask,
};

#[derive(Debug, Clone, Copy)]
pub(super) struct JiraCreationPlanningOptions<'a> {
    pub(super) creation_project_key: &'a str,
    pub(super) allow_missing_descriptions: bool,
    pub(super) include_exported_tasks: bool,
    pub(super) include_missing_description_tasks: bool,
}

#[derive(Debug, Clone)]
pub(super) struct JiraCreationTaskScope {
    pub(super) parent_tasks: Vec<LocalTask>,
    pub(super) subtask_tasks: Vec<LocalTask>,
    pub(super) skipped_issue_count: usize,
    pub(super) createable_task_count: usize,
    pub(super) progress_total_steps: usize,
    pub(super) local_blockers: Vec<String>,
}

impl JiraCreationTaskScope {
    pub(super) fn from_tasks(
        tasks: &[LocalTask],
        options: JiraCreationPlanningOptions<'_>,
    ) -> Self {
        let parent_tasks = tasks
            .iter()
            .filter(|task| {
                task.sync_status != "Created"
                    && task.issue_type != "Sub-task"
                    && (options.include_exported_tasks || task.sync_status != "Exported")
                    && (options.include_missing_description_tasks
                        || task.description_status != "Missing")
            })
            .cloned()
            .collect::<Vec<_>>();
        let included_parent_task_ids = parent_tasks
            .iter()
            .map(|task| task.id.as_str())
            .collect::<BTreeSet<_>>();
        let tasks_by_id = tasks
            .iter()
            .map(|task| (task.id.as_str(), task))
            .collect::<HashMap<_, _>>();
        let subtask_tasks = tasks
            .iter()
            .filter(|task| {
                task.sync_status != "Created"
                    && task.issue_type == "Sub-task"
                    && (options.include_exported_tasks || task.sync_status != "Exported")
                    && subtask_parent_is_included_or_created(
                        task,
                        &tasks_by_id,
                        &included_parent_task_ids,
                        options.include_exported_tasks,
                        options.include_missing_description_tasks,
                    )
            })
            .cloned()
            .collect::<Vec<_>>();
        let createable_task_count = parent_tasks.len() + subtask_tasks.len();
        let skipped_issue_count = tasks.len().saturating_sub(createable_task_count);
        let epic_group_count = count_project_area_groups(&parent_tasks);
        let progress_total_steps = 4 + epic_group_count + parent_tasks.len() + subtask_tasks.len();
        let local_blockers = validate_local_preflight(
            options.creation_project_key,
            &parent_tasks,
            &subtask_tasks,
            options.allow_missing_descriptions,
        );

        Self {
            parent_tasks,
            subtask_tasks,
            skipped_issue_count,
            createable_task_count,
            progress_total_steps,
            local_blockers,
        }
    }

    pub(super) fn with_metadata(
        self,
        metadata: &JiraCreateMetadata,
    ) -> Result<JiraCreationPlan, Vec<String>> {
        JiraCreationPlan::from_scope_and_metadata(self, metadata)
    }
}

fn subtask_parent_is_included_or_created(
    task: &LocalTask,
    tasks_by_id: &HashMap<&str, &LocalTask>,
    included_parent_task_ids: &BTreeSet<&str>,
    include_exported_tasks: bool,
    include_missing_description_tasks: bool,
) -> bool {
    let Some(parent_task_id) = task.parent_task_id.as_deref() else {
        return true;
    };

    if included_parent_task_ids.contains(parent_task_id) {
        return true;
    }

    let Some(parent_task) = tasks_by_id.get(parent_task_id) else {
        return true;
    };

    if parent_task.sync_status == "Created" {
        return true;
    }

    if !include_exported_tasks && parent_task.sync_status == "Exported" {
        return false;
    }

    if !include_missing_description_tasks && parent_task.description_status == "Missing" {
        return false;
    }

    true
}

#[derive(Debug, Clone)]
pub(super) struct JiraCreationPlan {
    pub(super) parent_tasks: Vec<LocalTask>,
    pub(super) subtask_tasks: Vec<LocalTask>,
    pub(super) skipped_issue_count: usize,
    pub(super) createable_task_count: usize,
    pub(super) project_area_groups: BTreeMap<(String, String), Vec<LocalTask>>,
    pub(super) issue_types: JiraCreationIssueTypePlans,
    pub(super) reporter: ReporterDecision,
    pub(super) missing_description_blockers: Vec<String>,
    pub(super) dependency_order: Vec<JiraCreationDependencyStep>,
    pub(super) progress_total_steps: usize,
}

impl JiraCreationPlan {
    pub(super) fn from_tasks_and_metadata(
        tasks: &[LocalTask],
        metadata: &JiraCreateMetadata,
        options: JiraCreationPlanningOptions<'_>,
    ) -> Result<Self, Vec<String>> {
        let scope = JiraCreationTaskScope::from_tasks(tasks, options);
        if !scope.local_blockers.is_empty() {
            return Err(scope.local_blockers);
        }
        scope.with_metadata(metadata)
    }

    fn from_scope_and_metadata(
        scope: JiraCreationTaskScope,
        metadata: &JiraCreateMetadata,
    ) -> Result<Self, Vec<String>> {
        let issue_types = JiraCreationIssueTypePlans::resolve(
            metadata,
            &scope.parent_tasks,
            &scope.subtask_tasks,
        )?;
        let reporter = if issue_types.requires_reporter() {
            ReporterDecision::Required
        } else {
            ReporterDecision::NotRequired
        };
        let missing_description_blockers =
            required_parent_description_blockers(&issue_types, &scope.parent_tasks);
        let project_area_groups = group_tasks_by_project_area(scope.parent_tasks.clone());
        let dependency_order = dependency_order_for(&project_area_groups, &scope.subtask_tasks);

        Ok(Self {
            parent_tasks: scope.parent_tasks,
            subtask_tasks: scope.subtask_tasks,
            skipped_issue_count: scope.skipped_issue_count,
            createable_task_count: scope.createable_task_count,
            project_area_groups,
            issue_types,
            reporter,
            missing_description_blockers,
            dependency_order,
            progress_total_steps: scope.progress_total_steps,
        })
    }

    pub(super) fn issue_type_for_local(&self, local_issue_type: &str) -> Option<&IssueTypePlan> {
        self.issue_types.issue_type_for_local(local_issue_type)
    }

    pub(super) fn issue_type_names(&self) -> Vec<String> {
        self.issue_types.issue_type_names()
    }

    pub(super) fn requires_reporter(&self) -> bool {
        matches!(self.reporter, ReporterDecision::Required)
    }
}

#[derive(Debug, Clone)]
pub(super) struct JiraCreationIssueTypePlans {
    pub(super) epic: IssueTypePlan,
    story: Option<IssueTypePlan>,
    bug: Option<IssueTypePlan>,
    pub(super) subtask: Option<IssueTypePlan>,
}

impl JiraCreationIssueTypePlans {
    fn resolve(
        metadata: &JiraCreateMetadata,
        parent_tasks: &[LocalTask],
        subtask_tasks: &[LocalTask],
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
        let subtask = if !subtask_tasks.is_empty() {
            find_issue_type(&metadata.issue_types, IssueTypeRole::SubTask)
                .map(|issue_type| IssueTypePlan::resolve(issue_type, IssueTypeRole::SubTask))
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
        if !subtask_tasks.is_empty() && subtask.is_none() {
            messages
                .push("Jira create metadata does not include a Sub-task issue type.".to_string());
        }

        let mut plans = vec![epic.clone()];
        if let Some(story) = story.clone() {
            plans.push(story);
        }
        if let Some(bug) = bug.clone() {
            plans.push(bug);
        }
        if let Some(subtask) = subtask.clone() {
            plans.push(subtask);
        }
        for plan in &plans {
            messages.extend(plan.validation_messages());
        }

        if messages.is_empty() {
            Ok(Self {
                epic,
                story,
                bug,
                subtask,
            })
        } else {
            Err(messages)
        }
    }

    fn issue_type_for_local(&self, local_issue_type: &str) -> Option<&IssueTypePlan> {
        match local_issue_type {
            "Story" => self.story.as_ref(),
            "Bug" => self.bug.as_ref(),
            "Sub-task" => self.subtask.as_ref(),
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
        if let Some(subtask) = &self.subtask {
            names.push(subtask.name.clone());
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
            || self
                .subtask
                .as_ref()
                .is_some_and(|subtask| subtask.requires_field("reporter"))
    }
}

#[derive(Debug, Clone)]
pub(super) struct IssueTypePlan {
    pub(super) id: String,
    pub(super) name: String,
    role: IssueTypeRole,
    fields: HashMap<String, JiraCreateFieldMetadata>,
    pub(super) epic_link_field: Option<EpicLinkFieldPlan>,
    pub(super) epic_name_field: Option<String>,
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

    pub(super) fn field(&self, key: &str) -> Option<&JiraCreateFieldMetadata> {
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
            "parent" => matches!(
                self.role,
                IssueTypeRole::Story | IssueTypeRole::Bug | IssueTypeRole::SubTask
            ),
            "description" => true,
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
pub(super) enum IssueTypeRole {
    Epic,
    Story,
    Bug,
    SubTask,
}

#[derive(Debug, Clone)]
pub(super) struct EpicLinkFieldPlan {
    pub(super) key: String,
    pub(super) style: EpicLinkStyle,
}

#[derive(Debug, Clone)]
pub(super) enum EpicLinkStyle {
    Parent,
    EpicLink,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ReporterDecision {
    Required,
    NotRequired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum JiraCreationDependencyStep {
    EpicGroup {
        local_project: String,
        area: String,
        parent_task_ids: Vec<String>,
    },
    ParentIssue {
        task_id: String,
    },
    SubTask {
        task_id: String,
        parent_task_id: Option<String>,
    },
}

fn validate_local_preflight(
    creation_project_key: &str,
    parent_tasks: &[LocalTask],
    subtask_tasks: &[LocalTask],
    allow_missing_descriptions: bool,
) -> Vec<String> {
    let mut messages = Vec::new();
    if creation_project_key.is_empty() {
        messages.push("Jira creation project key is required.".to_string());
    }
    if parent_tasks.is_empty() && subtask_tasks.is_empty() {
        messages.push("There are no pending Jira tasks to create.".to_string());
    }

    for task in parent_tasks.iter().chain(subtask_tasks.iter()) {
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
        if !matches!(task.issue_type.as_str(), "Story" | "Bug" | "Sub-task") {
            messages.push(format!(
                "{} has unsupported issue type {} for this Jira write slice.",
                task.title, task.issue_type
            ));
        }
    }

    messages
}

fn required_parent_description_blockers(
    plan: &JiraCreationIssueTypePlans,
    parent_tasks: &[LocalTask],
) -> Vec<String> {
    parent_tasks
        .iter()
        .filter_map(|task| {
            let issue_type = plan.issue_type_for_local(&task.issue_type)?;
            let description_required = issue_type
                .field("description")
                .is_some_and(|field| field.required);
            let has_description = task
                .description
                .as_deref()
                .is_some_and(|description| !description.trim().is_empty());

            if description_required && !has_description {
                Some(format!(
                    "{} is missing a description, and Jira requires Description for {}.",
                    task.title, issue_type.name
                ))
            } else {
                None
            }
        })
        .collect()
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

fn count_project_area_groups(tasks: &[LocalTask]) -> usize {
    tasks
        .iter()
        .map(|task| {
            (
                task.project.trim().to_string(),
                task.area.trim().to_string(),
            )
        })
        .collect::<BTreeSet<_>>()
        .len()
}

fn dependency_order_for(
    groups: &BTreeMap<(String, String), Vec<LocalTask>>,
    subtask_tasks: &[LocalTask],
) -> Vec<JiraCreationDependencyStep> {
    let mut steps = Vec::new();
    for ((local_project, area), group_tasks) in groups {
        let parent_task_ids = group_tasks
            .iter()
            .map(|task| task.id.clone())
            .collect::<Vec<_>>();
        steps.push(JiraCreationDependencyStep::EpicGroup {
            local_project: local_project.clone(),
            area: area.clone(),
            parent_task_ids,
        });
        for task in group_tasks {
            steps.push(JiraCreationDependencyStep::ParentIssue {
                task_id: task.id.clone(),
            });
        }
    }
    for task in subtask_tasks {
        steps.push(JiraCreationDependencyStep::SubTask {
            task_id: task.id.clone(),
            parent_task_id: task.parent_task_id.clone(),
        });
    }
    steps
}

pub(super) fn issue_type_name_matches(name: &str, role: IssueTypeRole) -> bool {
    let normalized = normalize_for_matching(name);
    match role {
        IssueTypeRole::Epic => matches!(normalized.as_str(), "epic" | "epica"),
        IssueTypeRole::Story => matches!(normalized.as_str(), "story" | "historia" | "user story"),
        IssueTypeRole::Bug => matches!(
            normalized.as_str(),
            "bug" | "error" | "defecto" | "incidencia"
        ),
        IssueTypeRole::SubTask => matches!(
            normalized.as_str(),
            "sub-task" | "subtask" | "sub tarea" | "subtarea"
        ),
    }
}

fn find_issue_type(
    issue_types: &[JiraCreateIssueTypeMetadata],
    role: IssueTypeRole,
) -> Option<&JiraCreateIssueTypeMetadata> {
    issue_types
        .iter()
        .filter(|issue_type| matches!(role, IssueTypeRole::SubTask) == issue_type.subtask)
        .find(|issue_type| issue_type_name_matches(&issue_type.name, role))
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::JiraCreateAllowedValue;

    #[test]
    fn plans_createable_tasks_groups_progress_and_dependency_order() {
        let tasks = vec![
            local_task(
                "parent-2",
                "PilotLab",
                "Bug",
                "Bug parent",
                "Bug",
                "Pending",
            ),
            local_task(
                "parent-1",
                "STT",
                "Programacion",
                "Story parent",
                "Story",
                "Pending",
            ),
            local_task(
                "created-parent",
                "STT",
                "Bug",
                "Already created",
                "Bug",
                "Created",
            ),
            local_subtask("sub-1", Some("parent-1"), "Pending"),
        ];
        let metadata = test_metadata("JTFTEST");

        let plan = JiraCreationPlan::from_tasks_and_metadata(
            &tasks,
            &metadata,
            JiraCreationPlanningOptions {
                creation_project_key: "JTFTEST",
                allow_missing_descriptions: true,
                include_exported_tasks: true,
                include_missing_description_tasks: true,
            },
        )
        .expect("plan builds");

        assert_eq!(plan.createable_task_count, 3);
        assert_eq!(plan.skipped_issue_count, 1);
        assert_eq!(plan.parent_tasks.len(), 2);
        assert_eq!(plan.subtask_tasks.len(), 1);
        assert_eq!(plan.project_area_groups.len(), 2);
        assert_eq!(plan.progress_total_steps, 9);
        assert_eq!(
            plan.issue_type_names(),
            vec![
                "Epic".to_string(),
                "Historia".to_string(),
                "Bug".to_string(),
                "Sub-task".to_string()
            ]
        );
        assert_eq!(
            plan.dependency_order,
            vec![
                JiraCreationDependencyStep::EpicGroup {
                    local_project: "PilotLab".to_string(),
                    area: "Bug".to_string(),
                    parent_task_ids: vec!["parent-2".to_string()],
                },
                JiraCreationDependencyStep::ParentIssue {
                    task_id: "parent-2".to_string(),
                },
                JiraCreationDependencyStep::EpicGroup {
                    local_project: "STT".to_string(),
                    area: "Programacion".to_string(),
                    parent_task_ids: vec!["parent-1".to_string()],
                },
                JiraCreationDependencyStep::ParentIssue {
                    task_id: "parent-1".to_string(),
                },
                JiraCreationDependencyStep::SubTask {
                    task_id: "sub-1".to_string(),
                    parent_task_id: Some("parent-1".to_string()),
                },
            ]
        );
    }

    #[test]
    fn returns_local_blockers_without_side_effects() {
        let tasks = vec![local_task(
            "task-1",
            "",
            "Bug",
            "Missing project",
            "Bug",
            "Pending",
        )];
        let scope = JiraCreationTaskScope::from_tasks(
            &tasks,
            JiraCreationPlanningOptions {
                creation_project_key: "",
                allow_missing_descriptions: false,
                include_exported_tasks: true,
                include_missing_description_tasks: true,
            },
        );

        assert_eq!(scope.createable_task_count, 1);
        assert_eq!(scope.skipped_issue_count, 0);
        assert!(scope
            .local_blockers
            .contains(&"Jira creation project key is required.".to_string()));
        assert!(scope
            .local_blockers
            .iter()
            .any(|message| message.contains("missing a local project")));
        assert!(scope
            .local_blockers
            .iter()
            .any(|message| message.contains("Confirm missing descriptions")));
    }

    #[test]
    fn excludes_missing_description_parent_tasks_and_their_pending_subtasks_when_requested() {
        let mut ready_parent = local_task(
            "ready-parent",
            "STT",
            "Programacion",
            "Ready parent",
            "Story",
            "Pending",
        );
        ready_parent.description_status = "Ready".to_string();
        let mut ready_child = local_subtask("ready-child", Some("ready-parent"), "Pending");
        ready_child.description_status = "Ready".to_string();
        let tasks = vec![
            ready_parent,
            ready_child,
            local_task(
                "missing-parent",
                "STT",
                "Bug",
                "Missing description parent",
                "Bug",
                "Pending",
            ),
            local_subtask("missing-child", Some("missing-parent"), "Pending"),
        ];

        let scope = JiraCreationTaskScope::from_tasks(
            &tasks,
            JiraCreationPlanningOptions {
                creation_project_key: "JTFTEST",
                allow_missing_descriptions: false,
                include_exported_tasks: true,
                include_missing_description_tasks: false,
            },
        );

        assert_eq!(scope.createable_task_count, 2);
        assert_eq!(scope.skipped_issue_count, 2);
        assert_eq!(
            scope
                .parent_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["ready-parent"]
        );
        assert_eq!(
            scope
                .subtask_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["ready-child"]
        );
        assert!(!scope
            .local_blockers
            .iter()
            .any(|message| message.contains("Confirm missing descriptions")));
    }

    #[test]
    fn records_reporter_decision_and_required_description_blockers_from_metadata() {
        let mut task = local_task(
            "task-1",
            "STT",
            "Programacion",
            "Needs description",
            "Story",
            "Pending",
        );
        task.description_status = "Ready".to_string();
        task.description = None;
        let mut metadata = test_metadata("JTFTEST");
        let story = metadata
            .issue_types
            .iter_mut()
            .find(|issue_type| issue_type.name == "Historia")
            .expect("story issue type exists");
        story.fields.push(field("reporter", "Reporter", true));
        story.fields.push(field("description", "Description", true));

        let plan = JiraCreationPlan::from_tasks_and_metadata(
            &[task],
            &metadata,
            JiraCreationPlanningOptions {
                creation_project_key: "JTFTEST",
                allow_missing_descriptions: true,
                include_exported_tasks: true,
                include_missing_description_tasks: true,
            },
        )
        .expect("plan builds");

        assert_eq!(plan.reporter, ReporterDecision::Required);
        assert_eq!(
            plan.missing_description_blockers,
            vec![
                "Needs description is missing a description, and Jira requires Description for Historia."
                    .to_string()
            ]
        );
    }

    #[test]
    fn blocks_when_metadata_cannot_supply_required_issue_type_fields() {
        let tasks = vec![local_task(
            "task-1",
            "STT",
            "Programacion",
            "Cannot link epic",
            "Story",
            "Pending",
        )];
        let mut metadata = test_metadata("JTFTEST");
        let story = metadata
            .issue_types
            .iter_mut()
            .find(|issue_type| issue_type.name == "Historia")
            .expect("story issue type exists");
        story.fields.retain(|field| field.key != "parent");

        let messages = JiraCreationPlan::from_tasks_and_metadata(
            &tasks,
            &metadata,
            JiraCreationPlanningOptions {
                creation_project_key: "JTFTEST",
                allow_missing_descriptions: true,
                include_exported_tasks: true,
                include_missing_description_tasks: true,
            },
        )
        .expect_err("metadata should block");

        assert!(messages
            .iter()
            .any(|message| message.contains("does not expose parent or Epic Link")));
    }

    fn local_task(
        id: &str,
        project: &str,
        area: &str,
        title: &str,
        issue_type: &str,
        sync_status: &str,
    ) -> LocalTask {
        LocalTask {
            id: id.to_string(),
            tray_id: "tray-1".to_string(),
            project: project.to_string(),
            area: area.to_string(),
            title: title.to_string(),
            priority: "High".to_string(),
            issue_type: issue_type.to_string(),
            sync_status: sync_status.to_string(),
            description_status: "Missing".to_string(),
            description: None,
            content_language: "Spanish".to_string(),
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            task_order: 0,
            created_at: "2026-05-26T00:00:00Z".to_string(),
            updated_at: "2026-05-26T00:00:00Z".to_string(),
        }
    }

    fn local_subtask(id: &str, parent_task_id: Option<&str>, sync_status: &str) -> LocalTask {
        let mut task = local_task(
            id,
            "STT",
            "Programacion",
            "Child step",
            "Sub-task",
            sync_status,
        );
        task.parent_task_id = parent_task_id.map(str::to_string);
        task
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
