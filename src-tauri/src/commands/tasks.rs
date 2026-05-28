use tauri::State;

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
    issue_type: String,
    content_language: String,
) -> Result<LocalTask, String> {
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
    let normalized_issue_type = if issue_type.trim().is_empty() {
        derive_issue_type_from_area(&area).to_string()
    } else {
        issue_type.trim().to_string()
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

fn derive_issue_type_from_area(area: &str) -> &'static str {
    if area.trim().eq_ignore_ascii_case("bug") {
        "Bug"
    } else {
        "Story"
    }
}

#[cfg(test)]
mod tests {
    use super::derive_issue_type_from_area;

    #[test]
    fn derives_bug_issue_type_only_from_bug_area() {
        assert_eq!(derive_issue_type_from_area("Bug"), "Bug");
        assert_eq!(derive_issue_type_from_area("  bug  "), "Bug");
        assert_eq!(derive_issue_type_from_area("Programacion"), "Story");
        assert_eq!(derive_issue_type_from_area("3D"), "Story");
        assert_eq!(derive_issue_type_from_area(""), "Story");
    }
}
