use super::AppServices;
use crate::db::DbResult;
use crate::models::{
    LocalIssueRelationship, LocalTask, NewSubtask, NewTask, NewTaskAttachment, NewTray, Tray,
};
use crate::repositories::{TaskRepository, TrayRepository};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

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

    pub fn add_task_attachments_from_paths(
        &self,
        task_id: &str,
        paths: &[String],
        purpose: &str,
    ) -> DbResult<Option<LocalTask>> {
        if paths.is_empty() {
            return Ok(self.find_task(task_id)?);
        }

        for path in paths {
            let source_path = Path::new(path);
            let metadata = fs::metadata(source_path)?;
            if !metadata.is_file() {
                return Err(crate::db::DbError::InvalidData(
                    "Only files can be attached.".to_string(),
                ));
            }
            let filename = source_path
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| {
                    crate::db::DbError::InvalidData(
                        "Attachment filename could not be read.".to_string(),
                    )
                })?;
            let relative_path = managed_attachment_relative_path(task_id, filename);
            let absolute_path = self.app_data_dir().join(&relative_path);
            copy_into_managed_attachment(source_path, &absolute_path)?;

            let create_result = {
                let connection = self.connection();
                TaskRepository::new(&connection).create_attachment(NewTaskAttachment {
                    task_id: task_id.to_string(),
                    display_filename: filename.to_string(),
                    mime_type: infer_mime_type(filename),
                    purpose: purpose.to_string(),
                    original_size_bytes: metadata.len() as i64,
                    original_relative_path: relative_path.to_string_lossy().to_string(),
                })
            };
            if let Err(error) = create_result {
                let _ = fs::remove_file(&absolute_path);
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
        let existing_attachment = self.find_task(task_id)?.and_then(|task| {
            task.attachments
                .into_iter()
                .find(|attachment| attachment.id == attachment_id)
        });
        let updated_task = {
            let connection = self.connection();
            TaskRepository::new(&connection).delete_attachment(task_id, attachment_id)?
        };
        if updated_task.is_some() {
            if let Some(attachment) = existing_attachment {
                let path = self.app_data_dir().join(attachment.original_relative_path);
                let _ = fs::remove_file(path);
            }
        }

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
}

fn managed_attachment_relative_path(task_id: &str, filename: &str) -> PathBuf {
    PathBuf::from("attachments")
        .join(sanitize_path_segment(task_id))
        .join(format!(
            "{}-{}",
            Uuid::new_v4(),
            sanitize_path_segment(filename)
        ))
}

fn copy_into_managed_attachment(source_path: &Path, destination_path: &Path) -> DbResult<()> {
    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source_path, destination_path)?;
    Ok(())
}

fn sanitize_path_segment(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "attachment".to_string()
    } else {
        sanitized
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
