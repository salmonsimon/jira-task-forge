use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::{utc_now_string, DbError, DbResult};
use crate::models::{AppSettings, Category, JqlFavorite, LocalTask, Tray};

use super::{attachment_files, audit_policy};

const BACKUP_APP: &str = "jira-task-forge";
const BACKUP_FORMAT_VERSION: u32 = 1;
const BACKUP_WARNING: &str = "Jira and AI credentials are excluded from this backup.";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackupManifest {
    pub app: String,
    pub format_version: u32,
    pub exported_at: String,
    pub export_id: String,
    pub source_app_version: Option<String>,
    pub record_counts: BTreeMap<String, usize>,
    pub sections: Vec<String>,
    pub attachments_included: bool,
    pub full_redacted_audit_included: bool,
    pub secrets_included: bool,
    pub warning: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackupFile {
    pub manifest: BackupManifest,
    pub data: BackupData,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackupData {
    pub trays: Vec<Tray>,
    pub tasks: Vec<LocalTask>,
    pub categories: Vec<Category>,
    pub epic_mappings: Vec<EpicMappingBackup>,
    pub jql_favorites: Vec<JqlFavorite>,
    pub settings: AppSettings,
    pub attachment_metadata: Vec<AttachmentBackup>,
    pub attachment_variants: Vec<AttachmentVariantBackup>,
    pub audit_summaries: Vec<AuditSummaryBackup>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EpicMappingBackup {
    pub id: String,
    pub project_category_id: String,
    pub area_category_id: String,
    pub jira_epic_key: String,
    pub jira_epic_url: Option<String>,
    pub synced_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttachmentBackup {
    pub id: String,
    pub task_id: String,
    pub display_filename: String,
    pub mime_type: Option<String>,
    pub purpose: String,
    pub original_size_bytes: i64,
    pub original_relative_path: String,
    pub file_hash: Option<String>,
    pub restore_status: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttachmentVariantBackup {
    pub id: String,
    pub attachment_id: String,
    pub profile: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub relative_path: String,
    pub accepted_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuditSummaryBackup {
    pub sync_attempt_id: Option<String>,
    pub tray_id: Option<String>,
    pub task_id: Option<String>,
    pub event_type: String,
    pub occurred_at: String,
    pub outcome: String,
    pub provider: Option<String>,
    pub operation: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupExportResult {
    pub path: String,
    pub record_counts: BTreeMap<String, usize>,
    pub secrets_included: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupImportResult {
    pub imported_counts: BTreeMap<String, usize>,
    pub skipped_counts: BTreeMap<String, usize>,
    pub warnings: Vec<String>,
}

pub(crate) fn build_manifest(
    data: &BackupData,
    source_app_version: Option<String>,
) -> DbResult<BackupManifest> {
    let record_counts = record_counts(data);

    Ok(BackupManifest {
        app: BACKUP_APP.to_string(),
        format_version: BACKUP_FORMAT_VERSION,
        exported_at: utc_now_string()?,
        export_id: Uuid::new_v4().to_string(),
        source_app_version,
        record_counts: record_counts.clone(),
        sections: record_counts.keys().cloned().collect(),
        attachments_included: attachment_files::files_included_in_current_export(),
        full_redacted_audit_included: audit_policy::full_redacted_audit_included_in_current_export(
        ),
        secrets_included: false,
        warning: BACKUP_WARNING.to_string(),
    })
}

pub(crate) fn validate_backup_file(backup: &BackupFile) -> DbResult<()> {
    if backup.manifest.app != BACKUP_APP {
        return Err(DbError::InvalidData(format!(
            "backup app must be {BACKUP_APP}"
        )));
    }
    if backup.manifest.format_version != BACKUP_FORMAT_VERSION {
        return Err(DbError::InvalidData(format!(
            "unsupported backup format version {}",
            backup.manifest.format_version
        )));
    }
    if backup.manifest.secrets_included {
        return Err(DbError::InvalidData(
            "backup unexpectedly claims to include secrets".to_string(),
        ));
    }

    Ok(())
}

pub(crate) fn record_counts(data: &BackupData) -> BTreeMap<String, usize> {
    BTreeMap::from([
        ("trays".to_string(), data.trays.len()),
        ("tasks".to_string(), data.tasks.len()),
        ("categories".to_string(), data.categories.len()),
        ("epicMappings".to_string(), data.epic_mappings.len()),
        ("jqlFavorites".to_string(), data.jql_favorites.len()),
        ("settings".to_string(), 1),
        (
            "attachmentMetadata".to_string(),
            data.attachment_metadata.len(),
        ),
        (
            "attachmentVariants".to_string(),
            data.attachment_variants.len(),
        ),
        ("auditSummaries".to_string(), data.audit_summaries.len()),
    ])
}
