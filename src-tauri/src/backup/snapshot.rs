use rusqlite::Connection;

use crate::db::{DbError, DbResult};
use crate::models::{
    AssistedDescriptionProposal, AssistedDescriptionProposalStatus, DescriptionProposalLogEntry,
    LocalTask, Tray,
};
use crate::repositories::{CategoryRepository, JqlFavoriteRepository, SettingsRepository};

use super::format::{
    AttachmentBackup, AttachmentVariantBackup, AuditSummaryBackup, BackupData, EpicMappingBackup,
};

pub(crate) fn export_snapshot(connection: &Connection) -> DbResult<BackupData> {
    let categories = CategoryRepository::new(connection).list(None)?;
    let jql_favorites = JqlFavoriteRepository::new(connection).list()?;

    Ok(BackupData {
        trays: list_trays(connection)?,
        tasks: list_tasks(connection)?,
        categories,
        epic_mappings: list_epic_mappings(connection)?,
        jql_favorites,
        settings: SettingsRepository::new(connection).get_app_settings()?,
        assisted_description_proposals: list_assisted_description_proposals(connection)?,
        description_proposal_log: list_description_proposal_log(connection)?,
        attachment_metadata: list_attachments(connection)?,
        attachment_variants: list_attachment_variants(connection)?,
        audit_summaries: list_audit_summaries(connection)?,
    })
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

fn list_assisted_description_proposals(
    connection: &Connection,
) -> DbResult<Vec<AssistedDescriptionProposal>> {
    let mut statement = connection.prepare(
        "
        SELECT id, task_id, title, summary, status, provider, model, user_comment,
               sections_json, created_at, updated_at, decided_at
        FROM assisted_description_proposals
        ORDER BY task_id ASC, created_at ASC
        ",
    )?;

    let proposals = statement
        .query_map([], |row| {
            let status_value: String = row.get(4)?;
            let status = AssistedDescriptionProposalStatus::from_db_value(&status_value).map_err(
                |message| {
                    rusqlite::Error::FromSqlConversionFailure(
                        status_value.len(),
                        rusqlite::types::Type::Text,
                        message.into(),
                    )
                },
            )?;
            let sections_json: String = row.get(8)?;
            let sections = serde_json::from_str(&sections_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    sections_json.len(),
                    rusqlite::types::Type::Text,
                    Box::new(DbError::InvalidData(error.to_string())),
                )
            })?;

            Ok(AssistedDescriptionProposal {
                id: row.get(0)?,
                task_id: row.get(1)?,
                title: row.get(2)?,
                summary: row.get(3)?,
                status,
                provider: row.get(5)?,
                model: row.get(6)?,
                user_comment: row.get(7)?,
                sections,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                decided_at: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(proposals)
}

fn list_description_proposal_log(
    connection: &Connection,
) -> DbResult<Vec<DescriptionProposalLogEntry>> {
    let mut statement = connection.prepare(
        "
        SELECT id, task_id, proposal_id, event_type, title, summary, status, provider,
               model, user_comment, detail_json, occurred_at
        FROM description_proposal_log_entries
        ORDER BY task_id ASC, occurred_at ASC
        ",
    )?;

    let entries = statement
        .query_map([], |row| {
            let status_value: String = row.get(6)?;
            let status = AssistedDescriptionProposalStatus::from_db_value(&status_value).map_err(
                |message| {
                    rusqlite::Error::FromSqlConversionFailure(
                        status_value.len(),
                        rusqlite::types::Type::Text,
                        message.into(),
                    )
                },
            )?;
            let detail_json: String = row.get(10)?;
            let detail = serde_json::from_str(&detail_json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    detail_json.len(),
                    rusqlite::types::Type::Text,
                    Box::new(DbError::InvalidData(error.to_string())),
                )
            })?;

            Ok(DescriptionProposalLogEntry {
                id: row.get(0)?,
                task_id: row.get(1)?,
                proposal_id: row.get(2)?,
                event_type: row.get(3)?,
                title: row.get(4)?,
                summary: row.get(5)?,
                status,
                provider: row.get(7)?,
                model: row.get(8)?,
                user_comment: row.get(9)?,
                detail,
                occurred_at: row.get(11)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(DbError::from)?;
    Ok(entries)
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
        issue_relationships: Vec::new(),
        attachments: Vec::new(),
        task_order: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}
