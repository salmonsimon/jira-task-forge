use super::AppServices;
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

        let contents = std::fs::read_to_string(path)
            .map_err(|error| format!("Could not read backup file: {error}"))?;
        let backup: BackupFile = serde_json::from_str(&contents)
            .map_err(|error| format!("Could not parse backup file: {error}"))?;
        let mut connection = self.connection();
        import_backup(&mut connection, backup).map_err(|error| error.to_string())
    }
}
