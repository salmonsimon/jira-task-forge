use super::AppServices;
use crate::attachment_storage::{
    copy_granted_source_into_managed_attachment, remove_managed_attachment_file,
    validate_managed_relative_path, AttachmentFileGrant,
};
use crate::db::{DbError, DbResult};
use crate::models::{
    LocalIssueRelationship, LocalTask, NewSubtask, NewTask, NewTaskAttachment, NewTray, Tray,
};
use crate::repositories::{TaskRepository, TrayRepository};
use std::path::Path;

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
        let attachment_paths = {
            let connection = self.connection();
            let Some(paths) =
                TaskRepository::new(&connection).attachment_paths_for_task_delete(task_id)?
            else {
                return Ok(false);
            };
            paths
        };
        self.remove_managed_attachment_files(&attachment_paths)?;

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

    pub fn add_task_attachments_from_paths(
        &self,
        task_id: &str,
        paths: &[String],
        purpose: &str,
    ) -> DbResult<Option<LocalTask>> {
        let _ = (task_id, paths, purpose);
        Err(DbError::InvalidData(
            "Attachment selection requires a backend file grant.".to_string(),
        ))
    }

    pub fn add_task_attachments_from_file_grants(
        &self,
        task_id: &str,
        grants: &[AttachmentFileGrant],
        purpose: &str,
    ) -> DbResult<Option<LocalTask>> {
        if grants.is_empty() {
            return Ok(self.find_task(task_id)?);
        }

        for grant in grants {
            let (filename, relative_path, size_bytes) =
                copy_granted_source_into_managed_attachment(
                    self.app_data_dir(),
                    grant,
                    task_id,
                    purpose,
                )?;

            let create_result = {
                let connection = self.connection();
                TaskRepository::new(&connection).create_attachment(NewTaskAttachment {
                    task_id: task_id.to_string(),
                    display_filename: filename.clone(),
                    mime_type: infer_mime_type(&filename),
                    purpose: purpose.to_string(),
                    original_size_bytes: size_bytes as i64,
                    original_relative_path: relative_path.clone(),
                })
            };
            if let Err(error) = create_result {
                let _ = remove_managed_attachment_file(self.app_data_dir(), &relative_path);
                return Err(error);
            }
        }

        self.find_task(task_id)
    }

    pub fn update_task_attachment_purpose(
        &self,
        task_id: &str,
        attachment_id: &str,
        purpose: &str,
    ) -> DbResult<Option<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection).update_attachment_purpose(task_id, attachment_id, purpose)
    }

    pub fn delete_task_attachment(
        &self,
        task_id: &str,
        attachment_id: &str,
    ) -> DbResult<Option<LocalTask>> {
        let Some(task) = self.find_task(task_id)? else {
            return Ok(None);
        };
        if task.sync_status == "Created" {
            return Ok(None);
        }
        if let Some(attachment) = task
            .attachments
            .iter()
            .find(|attachment| attachment.id == attachment_id)
        {
            remove_managed_attachment_file(
                self.app_data_dir(),
                &attachment.original_relative_path,
            )?;
        }

        let updated_task = {
            let connection = self.connection();
            TaskRepository::new(&connection).delete_attachment(task_id, attachment_id)?
        };

        Ok(updated_task)
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

    fn find_task(&self, task_id: &str) -> DbResult<Option<LocalTask>> {
        let connection = self.connection();
        TaskRepository::new(&connection).find_by_id(task_id)
    }

    pub(super) fn remove_managed_attachment_files(
        &self,
        relative_paths: &[String],
    ) -> DbResult<()> {
        for relative_path in relative_paths {
            validate_managed_relative_path(relative_path)?;
        }
        for relative_path in relative_paths {
            remove_managed_attachment_file(self.app_data_dir(), relative_path)?;
        }
        Ok(())
    }
}

fn infer_mime_type(filename: &str) -> Option<String> {
    let extension = Path::new(filename)
        .extension()
        .and_then(|value| value.to_str())?
        .to_ascii_lowercase();
    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "txt" => "text/plain",
        _ => return None,
    };
    Some(mime_type.to_string())
}
