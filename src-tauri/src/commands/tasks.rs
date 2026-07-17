use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::area_catalog::{
    derive_issue_type_from_area, resolve_catalog_area, CatalogAreaResolution,
};
use crate::attachment_storage::AttachmentFileGrant;
use crate::models::{LocalIssueRelationship, LocalTask, NewSubtask, NewTask, SyncAuditEvent, Tray};
use crate::services::AppServices;

#[tauri::command]
pub fn create_task(
    services: State<'_, AppServices>,
    tray_id: String,
    project: String,
    area: String,
    title: String,
    priority: String,
    _issue_type: String,
    content_language: String,
) -> Result<LocalTask, String> {
    let area = official_area_display_name(&area)?;
    let issue_type = derive_issue_type_from_area(&area).to_string();

    services
        .create_task(NewTask {
            tray_id,
            project,
            area,
            title,
            priority,
            issue_type,
            content_language,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_subtask(
    services: State<'_, AppServices>,
    parent_task_id: String,
    title: String,
) -> Result<LocalTask, String> {
    services
        .create_subtask(NewSubtask {
            parent_task_id,
            title,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_tasks(services: State<'_, AppServices>) -> Result<Vec<LocalTask>, String> {
    services.list_tasks().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_task(services: State<'_, AppServices>, task_id: String) -> Result<bool, String> {
    services
        .delete_task(&task_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_task_details(
    services: State<'_, AppServices>,
    task_id: String,
    project: String,
    area: String,
    title: String,
    priority: String,
    issue_type: String,
) -> Result<Option<LocalTask>, String> {
    let area = official_area_display_name(&area)?;
    let normalized_issue_type = if issue_type.trim() == "Sub-task" {
        "Sub-task".to_string()
    } else {
        derive_issue_type_from_area(&area).to_string()
    };

    services
        .update_task_details(
            &task_id,
            &project,
            &area,
            &title,
            &priority,
            &normalized_issue_type,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_task_description(
    services: State<'_, AppServices>,
    task_id: String,
    description: Option<String>,
    description_status: String,
) -> Result<Option<LocalTask>, String> {
    services
        .update_task_description(&task_id, description.as_deref(), &description_status)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_task_issue_relationships(
    services: State<'_, AppServices>,
    task_id: String,
    issue_relationships: Vec<LocalIssueRelationship>,
) -> Result<Option<LocalTask>, String> {
    services
        .update_task_issue_relationships(&task_id, &issue_relationships)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn add_task_attachments_from_paths(
    services: State<'_, AppServices>,
    task_id: String,
    paths: Vec<String>,
    purpose: String,
) -> Result<Option<LocalTask>, String> {
    services
        .add_task_attachments_from_paths(&task_id, &paths, &purpose)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn choose_task_attachment_files(
    app: AppHandle,
    services: State<'_, AppServices>,
    task_id: String,
    purpose: String,
) -> Result<Option<LocalTask>, String> {
    let selected_files = app
        .dialog()
        .file()
        .blocking_pick_files()
        .unwrap_or_default();
    let grants = selected_files
        .into_iter()
        .map(|file_path| {
            file_path
                .into_path()
                .map(AttachmentFileGrant::from_backend_file_dialog)
                .map_err(|error| format!("Attachment source path could not be read: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    services
        .add_task_attachments_from_file_grants(&task_id, &grants, &purpose)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_task_attachment_purpose(
    services: State<'_, AppServices>,
    task_id: String,
    attachment_id: String,
    purpose: String,
) -> Result<Option<LocalTask>, String> {
    services
        .update_task_attachment_purpose(&task_id, &attachment_id, &purpose)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_task_attachment(
    services: State<'_, AppServices>,
    task_id: String,
    attachment_id: String,
) -> Result<Option<LocalTask>, String> {
    services
        .delete_task_attachment(&task_id, &attachment_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn mark_tasks_csv_exported(
    services: State<'_, AppServices>,
    task_ids: Vec<String>,
) -> Result<Vec<LocalTask>, String> {
    services
        .mark_tasks_csv_exported(&task_ids)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_recovery_tray_from_tasks(
    services: State<'_, AppServices>,
    source_tray_id: String,
    task_ids: Vec<String>,
) -> Result<Tray, String> {
    services.create_recovery_tray_from_tasks(&source_tray_id, &task_ids)
}

#[tauri::command]
pub fn list_task_sync_audit_events(
    services: State<'_, AppServices>,
    task_id: String,
) -> Result<Vec<SyncAuditEvent>, String> {
    services
        .list_task_sync_audit_events(&task_id)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::official_area_display_name;
    use crate::area_catalog::derive_issue_type_from_area;

    #[test]
    fn derives_bug_issue_type_only_from_bug_area() {
        assert_eq!(derive_issue_type_from_area("Bug"), "Bug");
        assert_eq!(derive_issue_type_from_area("  bug  "), "Bug");
        assert_eq!(derive_issue_type_from_area("Programacion"), "Story");
        assert_eq!(derive_issue_type_from_area("3D"), "Story");
        assert_eq!(derive_issue_type_from_area(""), "Story");
    }

    #[test]
    fn keeps_manual_area_names_when_the_catalog_does_not_know_them() {
        assert_eq!(
            official_area_display_name("  Herramienta Recortes  ")
                .expect("manual area is accepted"),
            "Herramienta Recortes"
        );
    }

    #[test]
    fn still_normalizes_known_catalog_area_aliases() {
        assert_eq!(
            official_area_display_name("Programacion").expect("catalog alias resolves"),
            "Programación"
        );
    }
}

fn official_area_display_name(area: &str) -> Result<String, String> {
    let trimmed_area = area.trim();
    match resolve_catalog_area(area) {
        CatalogAreaResolution::Official {
            area_display_name, ..
        }
        | CatalogAreaResolution::Normalized {
            area_display_name, ..
        } => Ok(area_display_name.to_string()),
        CatalogAreaResolution::Blocked if !trimmed_area.is_empty() => Ok(trimmed_area.to_string()),
        CatalogAreaResolution::Blocked => {
            Err("Choose an area before saving this task.".to_string())
        }
    }
}
