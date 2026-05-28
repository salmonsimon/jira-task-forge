use super::AppServices;
use crate::db::DbResult;
use crate::models::{LocalIssueRelationship, LocalTask, NewSubtask, NewTask, NewTray, Tray};
use crate::repositories::{TaskRepository, TrayRepository};

impl AppServices {
    pub fn create_task(&self, new_task: NewTask) -> DbResult<LocalTask> {
        let connection = self.connection();
        TaskRepository::new(&connection).create(new_task)
    }

    pub fn create_subtask(&self, new_subtask: NewSubtask) -> DbResult<LocalTask> {
        let connection = self.connection();
        TaskRepository::new(&connection).create_subtask(new_subtask)
    }

    pub fn list_tasks(&self) -> DbResult<Vec<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection).list_all()
    }

    pub fn delete_task(&self, task_id: &str) -> DbResult<bool> {
        let connection = self.connection();
        TaskRepository::new(&connection).delete(task_id)
    }

    pub fn update_task_details(
        &self,
        task_id: &str,
        project: &str,
        area: &str,
        title: &str,
        priority: &str,
        issue_type: &str,
    ) -> DbResult<Option<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection)
            .update_details(task_id, project, area, title, priority, issue_type)
    }

    pub fn update_task_description(
        &self,
        task_id: &str,
        description: Option<&str>,
        description_status: &str,
    ) -> DbResult<Option<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection).update_description(
            task_id,
            description,
            description_status,
        )
    }

    pub fn update_task_issue_relationships(
        &self,
        task_id: &str,
        relationships: &[LocalIssueRelationship],
    ) -> DbResult<Option<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection).update_issue_relationships(task_id, relationships)
    }

    pub fn mark_tasks_csv_exported(&self, task_ids: &[String]) -> DbResult<Vec<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection).mark_csv_exported(task_ids)
    }

    pub fn create_recovery_tray_from_tasks(
        &self,
        source_tray_id: &str,
        task_ids: &[String],
    ) -> Result<Tray, String> {
        if task_ids.is_empty() {
            return Err("No failed tasks were selected for recovery.".to_string());
        }

        let connection = self.connection();
        let tray_repository = TrayRepository::new(&connection);
        let source_tray = tray_repository
            .find_by_id(source_tray_id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "Source tray not found.".to_string())?;
        let recovery_tray = tray_repository
            .create(NewTray {
                name: format!("Recovery - {}", source_tray.name),
            })
            .map_err(|error| error.to_string())?;
        TaskRepository::new(&connection)
            .move_tasks_to_tray(task_ids, &recovery_tray.id)
            .map_err(|error| error.to_string())?;

        Ok(recovery_tray)
    }
}
