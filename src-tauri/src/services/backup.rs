use super::AppServices;
use crate::attachment_storage::{
    complete_backup_import_staging, fail_backup_import_staging, stage_backup_import_file,
};
use crate::backup::{
    export_backup, import_backup, BackupExportResult, BackupFile, BackupImportResult,
};

impl AppServices {
    pub fn export_backup_file(
        &self,
        path: &str,
        source_app_version: Option<String>,
    ) -> Result<BackupExportResult, String> {
        if path.trim().is_empty() {
            return Err("Backup path cannot be empty.".to_string());
        }

        let connection = self.connection();
        let backup =
            export_backup(&connection, source_app_version).map_err(|error| error.to_string())?;
        let result = BackupExportResult {
            path: path.to_string(),
            record_counts: backup.manifest.record_counts.clone(),
            secrets_included: backup.manifest.secrets_included,
        };
        let contents = serde_json::to_string_pretty(&backup)
            .map_err(|error| format!("Could not serialize backup: {error}"))?;
        std::fs::write(path, contents)
            .map_err(|error| format!("Could not write backup file: {error}"))?;
        Ok(result)
    }

    pub fn import_backup_file(&self, path: &str) -> Result<BackupImportResult, String> {
        if path.trim().is_empty() {
            return Err("Backup path cannot be empty.".to_string());
        }

        let staging =
            stage_backup_import_file(self.app_data_dir(), std::path::Path::new(path.trim()))
                .map_err(|error| error.to_string())?;
        let contents = match std::fs::read_to_string(staging.staged_file()) {
            Ok(contents) => contents,
            Err(error) => {
                let message = format!("Could not read backup file: {error}");
                let _ = fail_backup_import_staging(&staging, &message);
                return Err(message);
            }
        };
        let backup: BackupFile = match serde_json::from_str(&contents) {
            Ok(backup) => backup,
            Err(error) => {
                let message = format!("Could not parse backup file: {error}");
                let _ = fail_backup_import_staging(&staging, &message);
                return Err(message);
            }
        };
        let mut connection = self.connection();
        match import_backup(&mut connection, backup) {
            Ok(result) => {
                complete_backup_import_staging(&staging).map_err(|error| error.to_string())?;
                Ok(result)
            }
            Err(error) => {
                let message = error.to_string();
                let _ = fail_backup_import_staging(&staging, &message);
                Err(message)
            }
        }
    }
}
