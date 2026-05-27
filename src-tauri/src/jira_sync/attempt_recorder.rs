use serde_json::{json, Value};

use rusqlite::Connection;

use crate::models::{JiraCreateIssuesResult, JiraCreateProgress, JiraFailedTaskResult, LocalTask};
use crate::repositories::{SyncRepository, TaskRepository};
use crate::sync_audit::{audit_error_detail, audit_error_messages_detail};

const JIRA_PROVIDER_OPERATION: &str = "create-parent-issues";

pub(super) struct SyncAttemptRecorder<'connection, 'progress, F>
where
    F: FnMut(JiraCreateProgress),
{
    connection: &'connection Connection,
    sync_repository: SyncRepository<'connection>,
    sync_attempt_id: String,
    tray_id: String,
    completed_steps: usize,
    total_steps: usize,
    report_progress: &'progress mut F,
}

impl<'connection, 'progress, F> SyncAttemptRecorder<'connection, 'progress, F>
where
    F: FnMut(JiraCreateProgress),
{
    pub(super) fn start(
        connection: &'connection Connection,
        tray_id: &str,
        tray_name: &str,
        jira_project_key: &str,
        include_exported_tasks: bool,
        report_progress: &'progress mut F,
    ) -> Result<Self, String> {
        let sync_repository = SyncRepository::new(connection);
        let sync_attempt_id = sync_repository
            .start_attempt(tray_id, "create-in-jira")
            .map_err(db_error_message)?;
        let mut recorder = Self {
            connection,
            sync_repository,
            sync_attempt_id,
            tray_id: tray_id.to_string(),
            completed_steps: 0,
            total_steps: 1,
            report_progress,
        };

        recorder.progress(
            "starting",
            "Starting Jira creation",
            Some(tray_name),
            "running",
        );
        recorder.record_event(
            None,
            "jira.sync.started",
            "succeeded",
            json!({
                "trayId": tray_id,
                "trayName": tray_name,
                "jiraProjectKey": jira_project_key,
                "includeExportedTasks": include_exported_tasks,
            }),
        )?;

        Ok(recorder)
    }

    pub(super) fn running_result(&self) -> JiraCreateIssuesResult {
        JiraCreateIssuesResult {
            sync_attempt_id: self.sync_attempt_id.clone(),
            status: "running".to_string(),
            created_issue_count: 0,
            skipped_issue_count: 0,
            failed_issue_count: 0,
            created_issues: Vec::new(),
            failed_tasks: Vec::new(),
            messages: Vec::new(),
        }
    }

    pub(super) fn sync_attempt_id(&self) -> &str {
        &self.sync_attempt_id
    }

    pub(super) fn set_total_steps(&mut self, total_steps: usize) {
        self.total_steps = total_steps;
    }

    pub(super) fn advance(&mut self) {
        self.completed_steps += 1;
    }

    pub(super) fn progress(&mut self, step: &str, label: &str, detail: Option<&str>, status: &str) {
        (self.report_progress)(JiraCreateProgress {
            sync_attempt_id: Some(self.sync_attempt_id.clone()),
            step: step.to_string(),
            label: label.to_string(),
            detail: detail.map(str::to_string),
            completed_steps: self.completed_steps,
            total_steps: self.total_steps,
            status: status.to_string(),
        });
    }

    pub(super) fn record_event(
        &self,
        task_id: Option<&str>,
        event_type: &str,
        outcome: &str,
        detail: Value,
    ) -> Result<(), String> {
        self.sync_repository
            .record_event(
                &self.sync_attempt_id,
                &self.tray_id,
                task_id,
                event_type,
                outcome,
                JIRA_PROVIDER_OPERATION,
                detail,
            )
            .map_err(db_error_message)
    }

    pub(super) fn record_metadata_preflight(
        &self,
        jira_project_key: &str,
        issue_types: Vec<String>,
        task_count: usize,
    ) -> Result<(), String> {
        self.record_event(
            None,
            "jira.metadata.preflight",
            "succeeded",
            json!({
                "jiraProjectKey": jira_project_key,
                "issueTypes": issue_types,
                "taskCount": task_count,
            }),
        )
    }

    pub(super) fn record_task_failure(
        &self,
        task: &LocalTask,
        message: &str,
        result: &mut JiraCreateIssuesResult,
        event_type: &str,
    ) -> Result<(), String> {
        TaskRepository::new(self.connection)
            .mark_jira_failed(&task.id)
            .map_err(db_error_message)?;
        self.record_event(
            Some(&task.id),
            event_type,
            "failed",
            audit_error_detail(message),
        )?;
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

    pub(super) fn finish_blocked(
        &self,
        messages: Vec<String>,
        mut result: JiraCreateIssuesResult,
    ) -> Result<JiraCreateIssuesResult, String> {
        result.status = "blocked".to_string();
        result.messages = messages;
        self.record_event(
            None,
            "jira.sync.blocked",
            "failed",
            audit_error_messages_detail(&result.messages),
        )?;
        self.sync_repository
            .finish_attempt(&self.sync_attempt_id, "failed")
            .map_err(db_error_message)?;
        Ok(result)
    }

    pub(super) fn finish(
        &mut self,
        mut result: JiraCreateIssuesResult,
        had_non_blocking_warning: bool,
    ) -> Result<JiraCreateIssuesResult, String> {
        self.progress("finalizing", "Finalizing Jira creation", None, "running");
        let final_status = if result.failed_issue_count == 0 && !had_non_blocking_warning {
            "succeeded"
        } else if result.created_issue_count == 0 {
            "failed"
        } else {
            "partial"
        };
        result.status = final_status.to_string();
        append_final_summary_messages(&mut result);

        self.sync_repository
            .finish_attempt(&self.sync_attempt_id, final_status)
            .map_err(db_error_message)?;
        self.completed_steps = self.total_steps;
        self.progress(
            "complete",
            "Jira creation finished",
            Some(&format!(
                "{} created, {} failed, {} skipped",
                result.created_issue_count, result.failed_issue_count, result.skipped_issue_count
            )),
            final_status,
        );
        Ok(result)
    }
}

fn append_final_summary_messages(result: &mut JiraCreateIssuesResult) {
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
}

fn db_error_message(error: crate::db::DbError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_database;
    use crate::models::NewTray;
    use crate::repositories::TrayRepository;

    #[test]
    fn emits_start_and_finish_progress_for_attempts() {
        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Recorder tray".to_string(),
            })
            .expect("tray creates");
        let mut progress = Vec::new();
        let mut report_progress = |next_progress| progress.push(next_progress);
        let mut recorder = SyncAttemptRecorder::start(
            &connection,
            &tray.id,
            &tray.name,
            "JTFTEST",
            true,
            &mut report_progress,
        )
        .expect("recorder starts");
        let mut result = recorder.running_result();
        result.created_issue_count = 1;

        let result = recorder.finish(result, false).expect("recorder finishes");

        assert_eq!(result.status, "succeeded");
        assert_eq!(progress[0].step, "starting");
        assert_eq!(progress.last().expect("final progress").step, "complete");
        assert_eq!(
            progress.last().expect("final progress").sync_attempt_id,
            Some(result.sync_attempt_id)
        );
    }
}
