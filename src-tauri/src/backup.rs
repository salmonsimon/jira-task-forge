use std::collections::BTreeMap;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::db::{utc_now_string, DbError, DbResult};
use crate::models::{AppSettings, Category, JqlFavorite, LocalTask, Tray};
use crate::repositories::{CategoryRepository, JqlFavoriteRepository, SettingsRepository};

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

pub fn export_backup(
    connection: &Connection,
    source_app_version: Option<String>,
) -> DbResult<BackupFile> {
    CategoryRepository::new(connection).list(None)?;
    JqlFavoriteRepository::new(connection).list()?;

    let data = BackupData {
        trays: list_trays(connection)?,
        tasks: list_tasks(connection)?,
        categories: CategoryRepository::new(connection).list(None)?,
        epic_mappings: list_epic_mappings(connection)?,
        jql_favorites: JqlFavoriteRepository::new(connection).list()?,
        settings: SettingsRepository::new(connection).get_app_settings()?,
        attachment_metadata: list_attachments(connection)?,
        attachment_variants: list_attachment_variants(connection)?,
        audit_summaries: list_audit_summaries(connection)?,
    };
    let record_counts = record_counts(&data);

    Ok(BackupFile {
        manifest: BackupManifest {
            app: "jira-task-forge".to_string(),
            format_version: 1,
            exported_at: utc_now_string()?,
            export_id: Uuid::new_v4().to_string(),
            source_app_version,
            record_counts: record_counts.clone(),
            sections: record_counts.keys().cloned().collect(),
            attachments_included: false,
            full_redacted_audit_included: false,
            secrets_included: false,
            warning: "Jira and AI credentials are excluded from this backup.".to_string(),
        },
        data,
    })
}

pub fn import_backup(
    connection: &mut Connection,
    backup: BackupFile,
) -> DbResult<BackupImportResult> {
    if backup.manifest.app != "jira-task-forge" {
        return Err(DbError::InvalidData(
            "backup app must be jira-task-forge".to_string(),
        ));
    }
    if backup.manifest.format_version != 1 {
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

    let transaction = connection.transaction()?;
    let mut imported_counts = BTreeMap::new();
    let mut skipped_counts = BTreeMap::new();
    let mut warnings = Vec::new();

    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "trays",
        import_trays(&transaction, &backup.data.trays)?,
        backup.data.trays.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "categories",
        import_categories(&transaction, &backup.data.categories)?,
        backup.data.categories.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "jqlFavorites",
        import_jql_favorites(&transaction, &backup.data.jql_favorites)?,
        backup.data.jql_favorites.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "tasks",
        import_tasks(&transaction, &backup.data.tasks)?,
        backup.data.tasks.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "epicMappings",
        import_epic_mappings(&transaction, &backup.data.epic_mappings, &mut warnings)?,
        backup.data.epic_mappings.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "attachmentMetadata",
        import_attachments(
            &transaction,
            &backup.data.attachment_metadata,
            &mut warnings,
        )?,
        backup.data.attachment_metadata.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "attachmentVariants",
        import_attachment_variants(
            &transaction,
            &backup.data.attachment_variants,
            &mut warnings,
        )?,
        backup.data.attachment_variants.len(),
    );

    SettingsRepository::new(&transaction).update_app_settings(backup.data.settings)?;
    imported_counts.insert("settings".to_string(), 1);
    if !backup.data.audit_summaries.is_empty() {
        warnings.push(
            "Audit summaries were reviewed but are not imported into local audit tables yet."
                .to_string(),
        );
        skipped_counts.insert(
            "auditSummaries".to_string(),
            backup.data.audit_summaries.len(),
        );
    }

    transaction.commit()?;

    Ok(BackupImportResult {
        imported_counts,
        skipped_counts,
        warnings,
    })
}

fn record_counts(data: &BackupData) -> BTreeMap<String, usize> {
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

fn count_insert(
    imported_counts: &mut BTreeMap<String, usize>,
    skipped_counts: &mut BTreeMap<String, usize>,
    key: &str,
    imported: usize,
    total: usize,
) {
    imported_counts.insert(key.to_string(), imported);
    skipped_counts.insert(key.to_string(), total.saturating_sub(imported));
}

fn list_trays(connection: &Connection) -> DbResult<Vec<Tray>> {
    let mut statement = connection.prepare(
        "
        SELECT id, name, state, created_at, updated_at, archived_at
        FROM trays
        ORDER BY updated_at DESC, created_at DESC
        ",
    )?;

    let trays = statement
        .query_map([], |row| {
            Ok(Tray {
                id: row.get(0)?,
                name: row.get(1)?,
                state: crate::models::TrayState::from_db_value(row.get::<_, String>(2)?.as_str())
                    .map_err(|message| {
                    rusqlite::Error::FromSqlConversionFailure(
                        2,
                        rusqlite::types::Type::Text,
                        message.into(),
                    )
                })?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                archived_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(trays)
}

fn list_tasks(connection: &Connection) -> DbResult<Vec<LocalTask>> {
    let mut statement = connection.prepare(
        "
        SELECT id, tray_id, project, area, title, priority, issue_type, sync_status,
               description_status, description, content_language, jira_key, jira_url, epic_key,
               parent_task_id, task_order, created_at, updated_at
        FROM tasks
        ORDER BY tray_id ASC, task_order ASC, created_at ASC
        ",
    )?;

    let tasks = statement
        .query_map([], map_task)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(tasks)
}

fn list_epic_mappings(connection: &Connection) -> DbResult<Vec<EpicMappingBackup>> {
    let mut statement = connection.prepare(
        "
        SELECT id, project_category_id, area_category_id, jira_epic_key, jira_epic_url,
               synced_at, created_at, updated_at
        FROM epic_mappings
        ORDER BY updated_at DESC, created_at DESC
        ",
    )?;

    let mappings = statement
        .query_map([], |row| {
            Ok(EpicMappingBackup {
                id: row.get(0)?,
                project_category_id: row.get(1)?,
                area_category_id: row.get(2)?,
                jira_epic_key: row.get(3)?,
                jira_epic_url: row.get(4)?,
                synced_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(mappings)
}

fn list_attachments(connection: &Connection) -> DbResult<Vec<AttachmentBackup>> {
    let mut statement = connection.prepare(
        "
        SELECT id, task_id, display_filename, mime_type, purpose, original_size_bytes,
               original_relative_path, file_hash, restore_status, created_at, updated_at
        FROM attachments
        ORDER BY created_at ASC
        ",
    )?;

    let attachments = statement
        .query_map([], |row| {
            Ok(AttachmentBackup {
                id: row.get(0)?,
                task_id: row.get(1)?,
                display_filename: row.get(2)?,
                mime_type: row.get(3)?,
                purpose: row.get(4)?,
                original_size_bytes: row.get(5)?,
                original_relative_path: row.get(6)?,
                file_hash: row.get(7)?,
                restore_status: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(attachments)
}

fn list_attachment_variants(connection: &Connection) -> DbResult<Vec<AttachmentVariantBackup>> {
    let mut statement = connection.prepare(
        "
        SELECT id, attachment_id, profile, mime_type, size_bytes, relative_path,
               accepted_at, created_at
        FROM attachment_variants
        ORDER BY created_at ASC
        ",
    )?;

    let variants = statement
        .query_map([], |row| {
            Ok(AttachmentVariantBackup {
                id: row.get(0)?,
                attachment_id: row.get(1)?,
                profile: row.get(2)?,
                mime_type: row.get(3)?,
                size_bytes: row.get(4)?,
                relative_path: row.get(5)?,
                accepted_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(variants)
}

fn list_audit_summaries(connection: &Connection) -> DbResult<Vec<AuditSummaryBackup>> {
    let mut statement = connection.prepare(
        "
        SELECT sync_attempt_id, tray_id, task_id, event_type, occurred_at, outcome, provider, operation
        FROM sync_audit_events
        ORDER BY occurred_at ASC
        ",
    )?;

    let summaries = statement
        .query_map([], |row| {
            Ok(AuditSummaryBackup {
                sync_attempt_id: row.get(0)?,
                tray_id: row.get(1)?,
                task_id: row.get(2)?,
                event_type: row.get(3)?,
                occurred_at: row.get(4)?,
                outcome: row.get(5)?,
                provider: row.get(6)?,
                operation: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(summaries)
}

fn import_trays(connection: &Connection, trays: &[Tray]) -> DbResult<usize> {
    let mut imported = 0;
    for tray in trays {
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO trays (id, name, state, created_at, updated_at, archived_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ",
            params![
                tray.id,
                tray.name,
                tray.state.as_db_value(),
                tray.created_at,
                tray.updated_at,
                tray.archived_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_categories(connection: &Connection, categories: &[Category]) -> DbResult<usize> {
    let mut imported = 0;
    for category in categories {
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO categories (
                id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, lower(trim(?3)), ?4, ?5, ?6, ?7, ?8)
            ",
            params![
                category.id,
                category.category_type,
                category.name,
                category.source,
                bool_to_db(category.hidden),
                bool_to_db(category.ignored),
                category.created_at,
                category.updated_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_jql_favorites(connection: &Connection, favorites: &[JqlFavorite]) -> DbResult<usize> {
    let mut imported = 0;
    for favorite in favorites {
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO jql_favorites (id, name, jql, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ",
            params![
                favorite.id,
                favorite.name,
                favorite.jql,
                favorite.created_at,
                favorite.updated_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_tasks(connection: &Connection, tasks: &[LocalTask]) -> DbResult<usize> {
    let mut imported = 0;
    let mut inserted_ids = Vec::new();
    for task in tasks {
        let changed = connection.execute(
            "
            INSERT OR IGNORE INTO tasks (
                id, tray_id, project, area, title, priority, issue_type, sync_status,
                description_status, description, content_language, jira_key, jira_url, epic_key,
                parent_task_id, task_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, ?15, ?16, ?17)
            ",
            params![
                task.id,
                task.tray_id,
                task.project,
                task.area,
                task.title,
                task.priority,
                task.issue_type,
                task.sync_status,
                task.description_status,
                task.description,
                task.content_language,
                task.jira_key,
                task.jira_url,
                task.epic_key,
                task.task_order,
                task.created_at,
                task.updated_at
            ],
        )?;
        if changed > 0 {
            imported += changed;
            inserted_ids.push(task.id.clone());
        }
    }

    for task in tasks.iter().filter(|task| inserted_ids.contains(&task.id)) {
        if let Some(parent_task_id) = &task.parent_task_id {
            connection.execute(
                "UPDATE tasks SET parent_task_id = ?1 WHERE id = ?2 AND EXISTS (SELECT 1 FROM tasks WHERE id = ?1)",
                (parent_task_id, task.id.as_str()),
            )?;
        }
    }

    Ok(imported)
}

fn import_epic_mappings(
    connection: &Connection,
    mappings: &[EpicMappingBackup],
    warnings: &mut Vec<String>,
) -> DbResult<usize> {
    let mut imported = 0;
    for mapping in mappings {
        if !category_exists(connection, &mapping.project_category_id)?
            || !category_exists(connection, &mapping.area_category_id)?
        {
            warnings.push(format!(
                "Skipped epic mapping {} because its category references were not imported.",
                mapping.jira_epic_key
            ));
            continue;
        }
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO epic_mappings (
                id, project_category_id, area_category_id, jira_epic_key, jira_epic_url,
                synced_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ",
            params![
                mapping.id,
                mapping.project_category_id,
                mapping.area_category_id,
                mapping.jira_epic_key,
                mapping.jira_epic_url,
                mapping.synced_at,
                mapping.created_at,
                mapping.updated_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_attachments(
    connection: &Connection,
    attachments: &[AttachmentBackup],
    warnings: &mut Vec<String>,
) -> DbResult<usize> {
    let mut imported = 0;
    for attachment in attachments {
        if !task_exists(connection, &attachment.task_id)? {
            warnings.push(format!(
                "Skipped attachment metadata {} because its task was not imported.",
                attachment.display_filename
            ));
            continue;
        }
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO attachments (
                id, task_id, display_filename, mime_type, purpose, original_size_bytes,
                original_relative_path, file_hash, restore_status, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ",
            params![
                attachment.id,
                attachment.task_id,
                attachment.display_filename,
                attachment.mime_type,
                attachment.purpose,
                attachment.original_size_bytes,
                attachment.original_relative_path,
                attachment.file_hash,
                attachment.restore_status,
                attachment.created_at,
                attachment.updated_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_attachment_variants(
    connection: &Connection,
    variants: &[AttachmentVariantBackup],
    warnings: &mut Vec<String>,
) -> DbResult<usize> {
    let mut imported = 0;
    for variant in variants {
        if !attachment_exists(connection, &variant.attachment_id)? {
            warnings.push(format!(
                "Skipped attachment variant {} because its attachment metadata was not imported.",
                variant.profile
            ));
            continue;
        }
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO attachment_variants (
                id, attachment_id, profile, mime_type, size_bytes, relative_path, accepted_at, created_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ",
            params![
                variant.id,
                variant.attachment_id,
                variant.profile,
                variant.mime_type,
                variant.size_bytes,
                variant.relative_path,
                variant.accepted_at,
                variant.created_at
            ],
        )?;
    }
    Ok(imported)
}

fn map_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalTask> {
    Ok(LocalTask {
        id: row.get(0)?,
        tray_id: row.get(1)?,
        project: row.get(2)?,
        area: row.get(3)?,
        title: row.get(4)?,
        priority: row.get(5)?,
        issue_type: row.get(6)?,
        sync_status: row.get(7)?,
        description_status: row.get(8)?,
        description: row.get(9)?,
        content_language: row.get(10)?,
        jira_key: row.get(11)?,
        jira_url: row.get(12)?,
        epic_key: row.get(13)?,
        parent_task_id: row.get(14)?,
        task_order: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

fn category_exists(connection: &Connection, id: &str) -> DbResult<bool> {
    exists(connection, "categories", id)
}

fn task_exists(connection: &Connection, id: &str) -> DbResult<bool> {
    exists(connection, "tasks", id)
}

fn attachment_exists(connection: &Connection, id: &str) -> DbResult<bool> {
    exists(connection, "attachments", id)
}

fn exists(connection: &Connection, table: &str, id: &str) -> DbResult<bool> {
    let sql = format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE id = ?1)");
    connection
        .query_row(sql.as_str(), [id], |row| row.get::<_, bool>(0))
        .map_err(DbError::from)
}

fn bool_to_db(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

#[allow(dead_code)]
fn parse_json(value: String) -> Value {
    serde_json::from_str(&value).unwrap_or(Value::Null)
}

#[cfg(test)]
mod tests {
    use super::{
        export_backup, import_backup, AttachmentBackup, AttachmentVariantBackup,
        AuditSummaryBackup, EpicMappingBackup,
    };
    use crate::db::open_in_memory_database;
    use crate::models::{NewTask, NewTray};
    use crate::repositories::{TaskRepository, TrayRepository};

    #[test]
    fn exports_backup_without_secrets() {
        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Backup tray".to_string(),
            })
            .expect("tray creates");
        TaskRepository::new(&connection)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Backup task".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");

        let backup =
            export_backup(&connection, Some("0.1.0-test".to_string())).expect("backup exports");

        assert_eq!(backup.manifest.app, "jira-task-forge");
        assert_eq!(backup.manifest.format_version, 1);
        assert!(!backup.manifest.secrets_included);
        assert_eq!(
            backup.manifest.source_app_version.as_deref(),
            Some("0.1.0-test")
        );
        assert_eq!(backup.manifest.record_counts["trays"], 1);
        assert_eq!(backup.manifest.record_counts["tasks"], 1);
        assert_eq!(backup.data.tasks[0].title, "Backup task");
    }

    #[test]
    fn imports_backup_by_merging_new_records() {
        let source = open_in_memory_database().expect("source database opens");
        let tray = TrayRepository::new(&source)
            .create(NewTray {
                name: "Imported tray".to_string(),
            })
            .expect("tray creates");
        TaskRepository::new(&source)
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "PilotLab".to_string(),
                area: "Polish".to_string(),
                title: "Imported task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let backup = export_backup(&source, None).expect("backup exports");

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["trays"], 1);
        assert_eq!(result.imported_counts["tasks"], 1);
        assert!(result.warnings.is_empty());
        assert_eq!(
            TrayRepository::new(&target).list().expect("trays list")[0].name,
            "Imported tray"
        );
        assert_eq!(
            TaskRepository::new(&target).list_all().expect("tasks list")[0].title,
            "Imported task"
        );
    }

    #[test]
    fn rejects_backups_that_claim_to_include_secrets() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.secrets_included = true;

        let mut target = open_in_memory_database().expect("target database opens");
        let error = import_backup(&mut target, backup).expect_err("secret backup rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: backup unexpectedly claims to include secrets"
        );
    }

    #[test]
    fn rejects_backups_from_other_apps() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.app = "other-app".to_string();

        let mut target = open_in_memory_database().expect("target database opens");
        let error = import_backup(&mut target, backup).expect_err("wrong app rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: backup app must be jira-task-forge"
        );
    }

    #[test]
    fn rejects_unsupported_backup_versions() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.format_version = 999;

        let mut target = open_in_memory_database().expect("target database opens");
        let error = import_backup(&mut target, backup).expect_err("unsupported version rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: unsupported backup format version 999"
        );
    }

    #[test]
    fn skips_duplicate_records_on_reimport() {
        let source = open_in_memory_database().expect("source database opens");
        let tray = TrayRepository::new(&source)
            .create(NewTray {
                name: "Duplicate tray".to_string(),
            })
            .expect("tray creates");
        TaskRepository::new(&source)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Duplicate task".to_string(),
                priority: "Low".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let backup = export_backup(&source, None).expect("backup exports");

        let mut target = open_in_memory_database().expect("target database opens");
        import_backup(&mut target, backup.clone()).expect("first import succeeds");
        let result = import_backup(&mut target, backup).expect("second import succeeds");

        assert_eq!(result.imported_counts["trays"], 0);
        assert_eq!(result.skipped_counts["trays"], 1);
        assert_eq!(result.imported_counts["tasks"], 0);
        assert_eq!(result.skipped_counts["tasks"], 1);
        assert_eq!(result.imported_counts["settings"], 1);
    }

    #[test]
    fn warns_and_skips_audit_summaries_on_import() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.audit_summaries.push(AuditSummaryBackup {
            sync_attempt_id: Some("attempt-1".to_string()),
            tray_id: None,
            task_id: None,
            event_type: "jira.create".to_string(),
            occurred_at: "2026-05-25T12:00:00Z".to_string(),
            outcome: "success".to_string(),
            provider: Some("jira".to_string()),
            operation: Some("create_issue".to_string()),
        });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.skipped_counts["auditSummaries"], 1);
        assert_eq!(
            result.warnings,
            vec!["Audit summaries were reviewed but are not imported into local audit tables yet."]
        );
    }

    #[test]
    fn warns_and_skips_epic_mappings_with_missing_categories() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.epic_mappings.push(EpicMappingBackup {
            id: "mapping-1".to_string(),
            project_category_id: "missing-project".to_string(),
            area_category_id: "missing-area".to_string(),
            jira_epic_key: "JTFTEST-1".to_string(),
            jira_epic_url: None,
            synced_at: None,
            created_at: "2026-05-25T12:00:00Z".to_string(),
            updated_at: "2026-05-25T12:00:00Z".to_string(),
        });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["epicMappings"], 0);
        assert_eq!(result.skipped_counts["epicMappings"], 1);
        assert_eq!(
            result.warnings,
            vec![
                "Skipped epic mapping JTFTEST-1 because its category references were not imported."
            ]
        );
    }

    #[test]
    fn warns_and_skips_attachment_metadata_with_missing_tasks() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.attachment_metadata.push(AttachmentBackup {
            id: "attachment-1".to_string(),
            task_id: "missing-task".to_string(),
            display_filename: "reference.png".to_string(),
            mime_type: Some("image/png".to_string()),
            purpose: "jira_attachment".to_string(),
            original_size_bytes: 123,
            original_relative_path: "attachments/reference.png".to_string(),
            file_hash: Some("hash".to_string()),
            restore_status: None,
            created_at: "2026-05-25T12:00:00Z".to_string(),
            updated_at: "2026-05-25T12:00:00Z".to_string(),
        });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["attachmentMetadata"], 0);
        assert_eq!(result.skipped_counts["attachmentMetadata"], 1);
        assert_eq!(
            result.warnings,
            vec!["Skipped attachment metadata reference.png because its task was not imported."]
        );
    }

    #[test]
    fn warns_and_skips_attachment_variants_with_missing_metadata() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup
            .data
            .attachment_variants
            .push(AttachmentVariantBackup {
                id: "variant-1".to_string(),
                attachment_id: "missing-attachment".to_string(),
                profile: "compressed".to_string(),
                mime_type: "image/webp".to_string(),
                size_bytes: 42,
                relative_path: "attachments/reference.webp".to_string(),
                accepted_at: None,
                created_at: "2026-05-25T12:00:00Z".to_string(),
            });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["attachmentVariants"], 0);
        assert_eq!(result.skipped_counts["attachmentVariants"], 1);
        assert_eq!(
            result.warnings,
            vec!["Skipped attachment variant compressed because its attachment metadata was not imported."]
        );
    }
}
