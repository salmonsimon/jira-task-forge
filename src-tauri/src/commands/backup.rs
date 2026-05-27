use std::path::Path;

use tauri::State;

use crate::backup::{BackupExportResult, BackupImportResult};
use crate::services::AppServices;

#[tauri::command]
pub fn export_backup(
    services: State<'_, AppServices>,
    path: String,
) -> Result<BackupExportResult, String> {
    services.export_backup_file(&path, Some(env!("CARGO_PKG_VERSION").to_string()))
}

#[tauri::command]
pub fn import_backup(
    services: State<'_, AppServices>,
    path: String,
) -> Result<BackupImportResult, String> {
    services.import_backup_file(&path)
}

#[tauri::command]
pub fn save_csv_file(path: String, contents: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("CSV path cannot be empty".to_string());
    }

    let path = Path::new(path);
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::save_csv_file;

    #[test]
    fn rejects_empty_csv_save_paths() {
        assert_eq!(
            save_csv_file("   ".to_string(), "summary".to_string())
                .expect_err("empty path should fail"),
            "CSV path cannot be empty"
        );
    }

    #[test]
    fn writes_csv_contents_to_selected_path() {
        let path =
            std::env::temp_dir().join(format!("jira-task-forge-csv-{}.csv", uuid::Uuid::new_v4()));

        save_csv_file(
            path.to_string_lossy().to_string(),
            "Summary,Issue Type\nTask,Story\n".to_string(),
        )
        .expect("csv saves");

        assert_eq!(
            std::fs::read_to_string(&path).expect("csv reads"),
            "Summary,Issue Type\nTask,Story\n"
        );
        std::fs::remove_file(path).expect("csv cleanup");
    }

    #[test]
    fn writes_csv_contents_to_source_tree_path() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join(format!("jira-task-forge-csv-{}.csv", uuid::Uuid::new_v4()));

        save_csv_file(
            path.to_string_lossy().to_string(),
            "Summary\nTask\n".to_string(),
        )
        .expect("source-tree csv saves");

        assert_eq!(
            std::fs::read_to_string(&path).expect("csv reads"),
            "Summary\nTask\n"
        );
        std::fs::remove_file(path).expect("csv cleanup");
    }
}
