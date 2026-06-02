use std::collections::{BTreeMap, BTreeSet};

use rusqlite::Connection;

use crate::attachment_storage::validate_managed_relative_path;
use crate::db::{DbError, DbResult};

use super::audit_policy;
use super::format::{validate_backup_file, BackupFile};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ImportPlan {
    pub(crate) backup: BackupFile,
    pub(crate) trays: SectionPlan,
    pub(crate) categories: SectionPlan,
    pub(crate) jql_favorites: SectionPlan,
    pub(crate) tasks: SectionPlan,
    pub(crate) epic_mappings: SectionPlan,
    pub(crate) assisted_description_proposals: SectionPlan,
    pub(crate) description_proposal_log: SectionPlan,
    pub(crate) attachment_metadata: SectionPlan,
    pub(crate) attachment_variants: SectionPlan,
    pub(crate) warnings: Vec<String>,
}

impl ImportPlan {
    pub(crate) fn planned_skipped_counts(&self) -> BTreeMap<String, usize> {
        BTreeMap::from([
            ("trays".to_string(), self.trays.planned_skipped_count()),
            (
                "categories".to_string(),
                self.categories.planned_skipped_count(),
            ),
            (
                "jqlFavorites".to_string(),
                self.jql_favorites.planned_skipped_count(),
            ),
            ("tasks".to_string(), self.tasks.planned_skipped_count()),
            (
                "epicMappings".to_string(),
                self.epic_mappings.planned_skipped_count(),
            ),
            (
                "assistedDescriptionProposals".to_string(),
                self.assisted_description_proposals.planned_skipped_count(),
            ),
            (
                "descriptionProposalLog".to_string(),
                self.description_proposal_log.planned_skipped_count(),
            ),
            (
                "attachmentMetadata".to_string(),
                self.attachment_metadata.planned_skipped_count(),
            ),
            (
                "attachmentVariants".to_string(),
                self.attachment_variants.planned_skipped_count(),
            ),
            ("settings".to_string(), 0),
            (
                "auditSummaries".to_string(),
                self.backup.data.audit_summaries.len(),
            ),
        ])
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SectionPlan {
    decisions: Vec<RecordDecision>,
}

impl SectionPlan {
    fn new(decisions: Vec<RecordDecision>) -> Self {
        Self { decisions }
    }

    pub(crate) fn selected<'a, T>(&'a self, records: &'a [T]) -> impl Iterator<Item = &'a T> + 'a {
        records
            .iter()
            .zip(self.decisions.iter())
            .filter_map(|(record, decision)| {
                if matches!(decision, RecordDecision::Import) {
                    Some(record)
                } else {
                    None
                }
            })
    }

    fn planned_skipped_count(&self) -> usize {
        self.decisions
            .iter()
            .filter(|decision| matches!(decision, RecordDecision::Skip))
            .count()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RecordDecision {
    Import,
    Skip,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct ImportTargetSnapshot {
    tray_ids: BTreeSet<String>,
    category_ids: BTreeSet<String>,
    category_keys: BTreeSet<(String, String)>,
    jql_favorite_ids: BTreeSet<String>,
    task_ids: BTreeSet<String>,
    epic_mapping_ids: BTreeSet<String>,
    epic_mapping_category_pairs: BTreeSet<(String, String)>,
    assisted_description_proposal_ids: BTreeSet<String>,
    description_proposal_log_ids: BTreeSet<String>,
    attachment_ids: BTreeSet<String>,
    attachment_variant_ids: BTreeSet<String>,
}

impl ImportTargetSnapshot {
    fn load(connection: &Connection) -> DbResult<Self> {
        Ok(Self {
            tray_ids: read_string_set(connection, "SELECT id FROM trays")?,
            category_ids: read_string_set(connection, "SELECT id FROM categories")?,
            category_keys: read_pair_set(
                connection,
                "SELECT category_type, normalized_name FROM categories",
            )?,
            jql_favorite_ids: read_string_set(connection, "SELECT id FROM jql_favorites")?,
            task_ids: read_string_set(connection, "SELECT id FROM tasks")?,
            epic_mapping_ids: read_string_set(connection, "SELECT id FROM epic_mappings")?,
            epic_mapping_category_pairs: read_pair_set(
                connection,
                "SELECT project_category_id, area_category_id FROM epic_mappings",
            )?,
            assisted_description_proposal_ids: read_string_set(
                connection,
                "SELECT id FROM assisted_description_proposals",
            )?,
            description_proposal_log_ids: read_string_set(
                connection,
                "SELECT id FROM description_proposal_log_entries",
            )?,
            attachment_ids: read_string_set(connection, "SELECT id FROM attachments")?,
            attachment_variant_ids: read_string_set(
                connection,
                "SELECT id FROM attachment_variants",
            )?,
        })
    }
}

pub(crate) fn create_import_plan(
    connection: &Connection,
    backup: BackupFile,
) -> DbResult<ImportPlan> {
    let target = ImportTargetSnapshot::load(connection)?;
    plan_import_for_target(backup, target)
}

pub(crate) fn plan_import_for_target(
    backup: BackupFile,
    target: ImportTargetSnapshot,
) -> DbResult<ImportPlan> {
    validate_backup_file(&backup)?;

    let mut known_tray_ids = target.tray_ids;
    let trays = SectionPlan::new(
        backup
            .data
            .trays
            .iter()
            .map(|tray| plan_id_insert(&mut known_tray_ids, &tray.id))
            .collect(),
    );

    let mut known_category_ids = target.category_ids;
    let mut known_category_keys = target.category_keys;
    let categories = SectionPlan::new(
        backup
            .data
            .categories
            .iter()
            .map(|category| {
                let category_key = (
                    category.category_type.clone(),
                    normalize_category_name(&category.name),
                );
                if known_category_ids.contains(&category.id)
                    || known_category_keys.contains(&category_key)
                {
                    RecordDecision::Skip
                } else {
                    known_category_ids.insert(category.id.clone());
                    known_category_keys.insert(category_key);
                    RecordDecision::Import
                }
            })
            .collect(),
    );

    let mut known_jql_favorite_ids = target.jql_favorite_ids;
    let jql_favorites = SectionPlan::new(
        backup
            .data
            .jql_favorites
            .iter()
            .map(|favorite| plan_id_insert(&mut known_jql_favorite_ids, &favorite.id))
            .collect(),
    );

    let mut known_task_ids = target.task_ids;
    let tasks = SectionPlan::new(
        backup
            .data
            .tasks
            .iter()
            .map(|task| plan_id_insert(&mut known_task_ids, &task.id))
            .collect(),
    );
    let imported_task_ids = backup
        .data
        .tasks
        .iter()
        .zip(tasks.decisions.iter())
        .filter_map(|(task, decision)| {
            if matches!(decision, RecordDecision::Import) {
                Some(task.id.clone())
            } else {
                None
            }
        })
        .collect::<BTreeSet<_>>();

    let mut warnings = Vec::new();
    let mut known_epic_mapping_ids = target.epic_mapping_ids;
    let mut known_epic_mapping_pairs = target.epic_mapping_category_pairs;
    let epic_mappings = SectionPlan::new(
        backup
            .data
            .epic_mappings
            .iter()
            .map(|mapping| {
                if !known_category_ids.contains(&mapping.project_category_id)
                    || !known_category_ids.contains(&mapping.area_category_id)
                {
                    warnings.push(format!(
                        "Skipped epic mapping {} because its category references were not imported.",
                        mapping.jira_epic_key
                    ));
                    return RecordDecision::Skip;
                }

                let category_pair = (
                    mapping.project_category_id.clone(),
                    mapping.area_category_id.clone(),
                );
                if known_epic_mapping_ids.contains(&mapping.id)
                    || known_epic_mapping_pairs.contains(&category_pair)
                {
                    RecordDecision::Skip
                } else {
                    known_epic_mapping_ids.insert(mapping.id.clone());
                    known_epic_mapping_pairs.insert(category_pair);
                    RecordDecision::Import
                }
            })
            .collect(),
    );

    let mut known_proposal_ids = target.assisted_description_proposal_ids;
    let assisted_description_proposals = SectionPlan::new(
        backup
            .data
            .assisted_description_proposals
            .iter()
            .map(|proposal| {
                if !known_task_ids.contains(&proposal.task_id) {
                    warnings.push(format!(
                        "Skipped assisted description proposal {} because its task was not imported.",
                        proposal.title
                    ));
                    return RecordDecision::Skip;
                }

                plan_id_insert(&mut known_proposal_ids, &proposal.id)
            })
            .collect(),
    );

    let mut known_description_log_ids = target.description_proposal_log_ids;
    let description_proposal_log = SectionPlan::new(
        backup
            .data
            .description_proposal_log
            .iter()
            .map(|entry| {
                if !known_task_ids.contains(&entry.task_id) {
                    warnings.push(format!(
                        "Skipped description proposal log entry {} because its task was not imported.",
                        entry.event_type
                    ));
                    return RecordDecision::Skip;
                }
                if let Some(proposal_id) = &entry.proposal_id {
                    if !known_proposal_ids.contains(proposal_id) {
                        warnings.push(format!(
                            "Skipped description proposal log entry {} because its proposal was not imported.",
                            entry.event_type
                        ));
                        return RecordDecision::Skip;
                    }
                }

                plan_id_insert(&mut known_description_log_ids, &entry.id)
            })
            .collect(),
    );

    let mut known_attachment_ids = target.attachment_ids;
    let attachment_metadata = SectionPlan::new(
        backup
            .data
            .attachment_metadata
            .iter()
            .map(|attachment| {
                if !known_task_ids.contains(&attachment.task_id) {
                    warnings.push(format!(
                        "Skipped attachment metadata {} because its task was not imported.",
                        attachment.display_filename
                    ));
                    return RecordDecision::Skip;
                }
                if !imported_task_ids.contains(&attachment.task_id) {
                    warnings.push(format!(
                        "Skipped attachment metadata {} because its task was not imported from this backup.",
                        attachment.display_filename
                    ));
                    return RecordDecision::Skip;
                }
                if validate_managed_relative_path(&attachment.original_relative_path).is_err() {
                    warnings.push(format!(
                        "Skipped attachment metadata {} because its managed path is unsafe.",
                        attachment.display_filename
                    ));
                    return RecordDecision::Skip;
                }

                plan_id_insert(&mut known_attachment_ids, &attachment.id)
            })
            .collect(),
    );

    let mut known_attachment_variant_ids = target.attachment_variant_ids;
    let attachment_variants = SectionPlan::new(
        backup
            .data
            .attachment_variants
            .iter()
            .map(|variant| {
                if !known_attachment_ids.contains(&variant.attachment_id) {
                    warnings.push(format!(
                        "Skipped attachment variant {} because its attachment metadata was not imported.",
                        variant.profile
                    ));
                    return RecordDecision::Skip;
                }
                if validate_managed_relative_path(&variant.relative_path).is_err() {
                    warnings.push(format!(
                        "Skipped attachment variant {} because its managed path is unsafe.",
                        variant.profile
                    ));
                    return RecordDecision::Skip;
                }

                plan_id_insert(&mut known_attachment_variant_ids, &variant.id)
            })
            .collect(),
    );

    warnings.extend(audit_policy::import_warnings(&backup.data.audit_summaries));

    Ok(ImportPlan {
        backup,
        trays,
        categories,
        jql_favorites,
        tasks,
        epic_mappings,
        assisted_description_proposals,
        description_proposal_log,
        attachment_metadata,
        attachment_variants,
        warnings,
    })
}

fn plan_id_insert(known_ids: &mut BTreeSet<String>, id: &str) -> RecordDecision {
    if known_ids.contains(id) {
        RecordDecision::Skip
    } else {
        known_ids.insert(id.to_string());
        RecordDecision::Import
    }
}

fn read_string_set(connection: &Connection, sql: &str) -> DbResult<BTreeSet<String>> {
    let mut statement = connection.prepare(sql)?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect::<Result<BTreeSet<_>, _>>()
        .map_err(DbError::from)
}

fn read_pair_set(connection: &Connection, sql: &str) -> DbResult<BTreeSet<(String, String)>> {
    let mut statement = connection.prepare(sql)?;
    let rows = statement.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    rows.collect::<Result<BTreeSet<_>, _>>()
        .map_err(DbError::from)
}

fn normalize_category_name(name: &str) -> String {
    name.trim().to_lowercase()
}
