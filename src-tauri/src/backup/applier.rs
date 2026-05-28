use std::collections::BTreeMap;

use rusqlite::{params, Connection};

use crate::db::DbResult;
use crate::models::{
    AssistedDescriptionProposal, Category, DescriptionProposalLogEntry, JqlFavorite, LocalTask,
    Tray,
};
use crate::repositories::SettingsRepository;

use super::format::{
    AttachmentBackup, AttachmentVariantBackup, BackupFile, BackupImportResult, EpicMappingBackup,
};
use super::import_plan::{create_import_plan, ImportPlan};

pub fn import_backup(
    connection: &mut Connection,
    backup: BackupFile,
) -> DbResult<BackupImportResult> {
    let plan = create_import_plan(connection, backup)?;
    apply_import_plan(connection, plan)
}

fn apply_import_plan(
    connection: &mut Connection,
    plan: ImportPlan,
) -> DbResult<BackupImportResult> {
    let transaction = connection.transaction()?;
    let mut imported_counts = BTreeMap::new();
    let mut skipped_counts = BTreeMap::new();

    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "trays",
        import_trays(
            &transaction,
            &plan
                .trays
                .selected(&plan.backup.data.trays)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.trays.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "categories",
        import_categories(
            &transaction,
            &plan
                .categories
                .selected(&plan.backup.data.categories)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.categories.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "jqlFavorites",
        import_jql_favorites(
            &transaction,
            &plan
                .jql_favorites
                .selected(&plan.backup.data.jql_favorites)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.jql_favorites.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "tasks",
        import_tasks(
            &transaction,
            &plan
                .tasks
                .selected(&plan.backup.data.tasks)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.tasks.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "epicMappings",
        import_epic_mappings(
            &transaction,
            &plan
                .epic_mappings
                .selected(&plan.backup.data.epic_mappings)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.epic_mappings.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "assistedDescriptionProposals",
        import_assisted_description_proposals(
            &transaction,
            &plan
                .assisted_description_proposals
                .selected(&plan.backup.data.assisted_description_proposals)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.assisted_description_proposals.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "descriptionProposalLog",
        import_description_proposal_log(
            &transaction,
            &plan
                .description_proposal_log
                .selected(&plan.backup.data.description_proposal_log)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.description_proposal_log.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "attachmentMetadata",
        import_attachments(
            &transaction,
            &plan
                .attachment_metadata
                .selected(&plan.backup.data.attachment_metadata)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.attachment_metadata.len(),
    );
    count_insert(
        &mut imported_counts,
        &mut skipped_counts,
        "attachmentVariants",
        import_attachment_variants(
            &transaction,
            &plan
                .attachment_variants
                .selected(&plan.backup.data.attachment_variants)
                .collect::<Vec<_>>(),
        )?,
        plan.backup.data.attachment_variants.len(),
    );

    SettingsRepository::new(&transaction).update_app_settings(plan.backup.data.settings)?;
    imported_counts.insert("settings".to_string(), 1);
    if !plan.backup.data.audit_summaries.is_empty() {
        skipped_counts.insert(
            "auditSummaries".to_string(),
            plan.backup.data.audit_summaries.len(),
        );
    }

    transaction.commit()?;

    Ok(BackupImportResult {
        imported_counts,
        skipped_counts,
        warnings: plan.warnings,
    })
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

fn import_trays(connection: &Connection, trays: &[&Tray]) -> DbResult<usize> {
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

fn import_categories(connection: &Connection, categories: &[&Category]) -> DbResult<usize> {
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

fn import_jql_favorites(connection: &Connection, favorites: &[&JqlFavorite]) -> DbResult<usize> {
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

fn import_tasks(connection: &Connection, tasks: &[&LocalTask]) -> DbResult<usize> {
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
    mappings: &[&EpicMappingBackup],
) -> DbResult<usize> {
    let mut imported = 0;
    for mapping in mappings {
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

fn import_assisted_description_proposals(
    connection: &Connection,
    proposals: &[&AssistedDescriptionProposal],
) -> DbResult<usize> {
    let mut imported = 0;
    for proposal in proposals {
        let sections_json = serde_json::to_string(&proposal.sections)
            .map_err(|error| crate::db::DbError::InvalidData(error.to_string()))?;
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO assisted_description_proposals (
                id, task_id, title, summary, status, provider, model, user_comment,
                sections_json, created_at, updated_at, decided_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ",
            params![
                proposal.id,
                proposal.task_id,
                proposal.title,
                proposal.summary,
                proposal.status.as_db_value(),
                proposal.provider,
                proposal.model,
                proposal.user_comment,
                sections_json,
                proposal.created_at,
                proposal.updated_at,
                proposal.decided_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_description_proposal_log(
    connection: &Connection,
    entries: &[&DescriptionProposalLogEntry],
) -> DbResult<usize> {
    let mut imported = 0;
    for entry in entries {
        let detail_json = serde_json::to_string(&entry.detail)
            .map_err(|error| crate::db::DbError::InvalidData(error.to_string()))?;
        imported += connection.execute(
            "
            INSERT OR IGNORE INTO description_proposal_log_entries (
                id, task_id, proposal_id, event_type, title, summary, status, provider,
                model, user_comment, detail_json, occurred_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ",
            params![
                entry.id,
                entry.task_id,
                entry.proposal_id,
                entry.event_type,
                entry.title,
                entry.summary,
                entry.status.as_db_value(),
                entry.provider,
                entry.model,
                entry.user_comment,
                detail_json,
                entry.occurred_at
            ],
        )?;
    }
    Ok(imported)
}

fn import_attachments(
    connection: &Connection,
    attachments: &[&AttachmentBackup],
) -> DbResult<usize> {
    let mut imported = 0;
    for attachment in attachments {
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
    variants: &[&AttachmentVariantBackup],
) -> DbResult<usize> {
    let mut imported = 0;
    for variant in variants {
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

fn bool_to_db(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}
