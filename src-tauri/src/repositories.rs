use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use uuid::Uuid;

use crate::area_catalog::{
    SyncedAreaFormatRule, SyncedCatalogArea, SyncedDeliveryFormat, OFFICIAL_AREAS,
};
use crate::attachment_storage::validate_managed_relative_path;
use crate::db::{utc_now_string, DbError, DbResult};
use crate::epic_scope::normalize_epic_scope;
use crate::integrations::jira::normalize_jira_site_url;
use crate::models::{
    AppSettings, AssistedDescriptionProposal, AssistedDescriptionProposalSection,
    AssistedDescriptionProposalStatus, Category, DescriptionProposalLogEntry,
    DescriptionSectionStatus, JqlFavorite, LocalIssueRelationship, LocalTask,
    NewAssistedDescriptionProposal, NewSubtask, NewTask, NewTaskAttachment, NewTray,
    SyncAuditEvent, TaskAttachment, Tray, TrayState,
};
use crate::project_sync::{
    normalize_project_name, unique_project_names, ProjectSyncApplyRequest, ProjectSyncDecision,
    ProjectSyncCandidate, TRANSVERSAL_PROJECT_NAME,
};
use crate::sync_audit::SyncAuditDetail;

const APP_SETTINGS_KEY: &str = "app_settings";
const DEFAULT_PROJECT_CATEGORIES: &[(&str, bool)] = &[
    ("STT", false),
    ("PilotLab", false),
    ("MR Studio", false),
    ("Transversal", false),
    ("Legacy Sandbox", true),
];
const DEFAULT_JQL_FAVORITES: &[(&str, &str)] = &[
    (
        "Urgent open bugs",
        "project = DTS AND labels = \"Bug\" AND priority in (High, Highest) AND statusCategory != Done ORDER BY priority DESC",
    ),
    (
        "3D pending by project",
        "project = DTS AND labels = \"3D\" AND statusCategory != Done ORDER BY updated DESC",
    ),
];
const ASSISTED_DESCRIPTION_SECTION_DEFINITIONS: &[(&str, &str)] = &[
    ("user_story", "Historia de usuario"),
    ("problem", "Contexto"),
    ("context_impact", "Contexto / impacto"),
    ("scope", "Alcance"),
    ("reproduction_steps", "Pasos para reproducir"),
    ("actual_result", "Resultado actual"),
    ("expected_result", "Resultado esperado"),
    ("evidence", "Evidencia"),
    ("acceptance_criteria", "Criterios de aceptacion"),
    ("minimum_deliverable", "Entregable mínimo"),
    ("review_checklist", "Checklist antes de Review"),
];

pub struct TrayRepository<'connection> {
    connection: &'connection Connection,
}

pub struct TaskRepository<'connection> {
    connection: &'connection Connection,
}

pub struct AssistedDescriptionProposalRepository<'connection> {
    connection: &'connection Connection,
}

pub struct SettingsRepository<'connection> {
    connection: &'connection Connection,
}

pub struct CategoryRepository<'connection> {
    connection: &'connection Connection,
}

pub struct JqlFavoriteRepository<'connection> {
    connection: &'connection Connection,
}

pub struct SyncRepository<'connection> {
    connection: &'connection Connection,
}

impl<'connection> SettingsRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn get_app_settings(&self) -> DbResult<AppSettings> {
        let result = self.connection.query_row(
            "SELECT value_json FROM settings WHERE key = ?1",
            [APP_SETTINGS_KEY],
            |row| row.get::<_, String>(0),
        );

        let value_json = match result {
            Ok(value_json) => value_json,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(AppSettings::default()),
            Err(error) => return Err(error.into()),
        };

        serde_json::from_str(&value_json).map_err(|error| DbError::InvalidData(error.to_string()))
    }

    pub fn update_app_settings(&self, mut settings: AppSettings) -> DbResult<AppSettings> {
        let current_settings = self.get_app_settings()?;
        if settings.jira_site_url != current_settings.jira_site_url {
            settings.jira_site_url =
                normalize_jira_site_url(&settings.jira_site_url).map_err(DbError::InvalidData)?;
        }
        let updated_at = utc_now_string()?;
        let value_json = serde_json::to_string(&settings)
            .map_err(|error| DbError::InvalidData(error.to_string()))?;

        self.connection.execute(
            "
            INSERT INTO settings (key, value_json, updated_at)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
            ",
            (APP_SETTINGS_KEY, value_json, updated_at),
        )?;

        Ok(settings)
    }
}

impl<'connection> CategoryRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn list(&self, category_type: Option<&str>) -> DbResult<Vec<Category>> {
        self.ensure_defaults_seeded()?;

        if let Some(category_type) = category_type {
            validate_category_type(category_type)?;
            let mut statement = self.connection.prepare(
                "
                SELECT id, category_type, name, source, hidden, ignored, created_at, updated_at
                FROM categories
                WHERE category_type = ?1 AND ignored = 0
                ORDER BY hidden ASC, name COLLATE NOCASE ASC
                ",
            )?;

            let categories = statement
                .query_map([category_type], map_category_row)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(DbError::from)?;
            return Ok(categories);
        }

        let mut statement = self.connection.prepare(
            "
            SELECT id, category_type, name, source, hidden, ignored, created_at, updated_at
            FROM categories
            WHERE ignored = 0
            ORDER BY category_type ASC, hidden ASC, name COLLATE NOCASE ASC
            ",
        )?;

        let categories = statement
            .query_map([], map_category_row)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DbError::from)?;
        Ok(categories)
    }

    pub fn create(&self, category_type: &str, name: &str) -> DbResult<Category> {
        validate_category_type(category_type)?;
        let name = normalize_display_name(name)?;
        let normalized_name = normalize_name(&name);
        let now = utc_now_string()?;
        let id = Uuid::new_v4().to_string();

        self.connection.execute(
            "
            INSERT INTO categories (
                id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, 'local', 0, 0, ?5, ?5)
            ",
            (
                id.as_str(),
                category_type,
                name.as_str(),
                normalized_name.as_str(),
                now.as_str(),
            ),
        )?;

        self.find_by_id(&id)?
            .ok_or_else(|| DbError::InvalidData("category was not created".to_string()))
    }

    pub fn update(
        &self,
        id: &str,
        name: Option<&str>,
        hidden: Option<bool>,
    ) -> DbResult<Option<Category>> {
        let Some(current) = self.find_by_id(id)? else {
            return Ok(None);
        };
        let next_name = match name {
            Some(name) => normalize_display_name(name)?,
            None => current.name,
        };
        let normalized_name = normalize_name(&next_name);
        let next_hidden = hidden.unwrap_or(current.hidden);
        let next_source = if current.category_type == "area" && name.is_some() {
            "local"
        } else {
            current.source.as_str()
        };
        let now = utc_now_string()?;

        self.connection.execute(
            "
            UPDATE categories
            SET name = ?1, normalized_name = ?2, hidden = ?3, source = ?4, updated_at = ?5
            WHERE id = ?6
            ",
            (
                next_name.as_str(),
                normalized_name.as_str(),
                bool_to_db(next_hidden),
                next_source,
                now.as_str(),
                id,
            ),
        )?;

        self.find_by_id(id)
    }

    pub fn delete(&self, id: &str) -> DbResult<bool> {
        if self.find_by_id(id)?.is_none() {
            return Ok(false);
        }
        let changed = self
            .connection
            .execute("DELETE FROM categories WHERE id = ?1", [id])?;
        Ok(changed > 0)
    }

    pub fn list_project_sync_decisions(&self) -> DbResult<Vec<ProjectSyncDecision>> {
        let mut statement = self.connection.prepare(
            "
            SELECT normalized_name, display_name, status, jira_issue_keys_json
            FROM project_sync_decisions
            ORDER BY display_name COLLATE NOCASE ASC
            ",
        )?;

        let decisions = statement
            .query_map([], |row| {
                let keys_json: String = row.get("jira_issue_keys_json")?;
                let jira_issue_keys = serde_json::from_str::<Vec<String>>(&keys_json)
                    .unwrap_or_else(|_| Vec::new());
                Ok(ProjectSyncDecision {
                    name: row.get("display_name")?,
                    normalized_name: row.get("normalized_name")?,
                    status: row.get("status")?,
                    jira_issue_keys,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(decisions)
    }

    pub fn apply_project_sync_decisions(
        &self,
        request: ProjectSyncApplyRequest,
    ) -> DbResult<Vec<Category>> {
        let active_names = unique_project_names(&request.active_project_names);
        let ignored_names = unique_project_names(&request.ignored_project_names);
        let archived_names = unique_project_names(&request.archived_project_names);
        let candidate_by_normalized = request
            .candidates
            .iter()
            .map(|candidate| (candidate.normalized_name.clone(), candidate))
            .collect::<std::collections::HashMap<_, _>>();

        let mut active_names = active_names;
        if !active_names
            .iter()
            .any(|name| normalize_project_name(name) == normalize_project_name(TRANSVERSAL_PROJECT_NAME))
        {
            active_names.insert(0, TRANSVERSAL_PROJECT_NAME.to_string());
        }

        for name in &active_names {
            self.upsert_project_sync_category(
                name,
                "active",
                false,
                candidate_by_normalized.get(&normalize_project_name(name)).copied(),
            )?;
        }

        for name in archived_names {
            if normalize_project_name(&name) == normalize_project_name(TRANSVERSAL_PROJECT_NAME) {
                continue;
            }
            self.upsert_project_sync_category(
                &name,
                "archived",
                true,
                candidate_by_normalized.get(&normalize_project_name(&name)).copied(),
            )?;
        }

        for name in ignored_names {
            if normalize_project_name(&name) == normalize_project_name(TRANSVERSAL_PROJECT_NAME) {
                continue;
            }
            self.remember_project_sync_decision(
                &name,
                "ignored",
                candidate_by_normalized
                    .get(&normalize_project_name(&name))
                    .map(|candidate| candidate.jira_issue_keys.as_slice())
                    .unwrap_or(&[]),
            )?;
            self.connection.execute(
                "
                UPDATE categories
                SET ignored = CASE WHEN source = 'jira' THEN 1 ELSE ignored END,
                    updated_at = ?1
                WHERE category_type = 'project' AND normalized_name = ?2
                ",
                (utc_now_string()?.as_str(), normalize_name(&name).as_str()),
            )?;
        }

        self.list(Some("project"))
    }

    fn upsert_project_sync_category(
        &self,
        name: &str,
        status: &str,
        hidden: bool,
        candidate: Option<&ProjectSyncCandidate>,
    ) -> DbResult<()> {
        let name = normalize_display_name(name)?;
        let normalized_name = normalize_name(&name);
        let now = utc_now_string()?;
        let id = Uuid::new_v4().to_string();
        self.connection.execute(
            "
            INSERT INTO categories (
                id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at
            )
            VALUES (?1, 'project', ?2, ?3, 'jira', ?4, 0, ?5, ?5)
            ON CONFLICT(category_type, normalized_name) DO UPDATE SET
                name = excluded.name,
                source = 'jira',
                hidden = excluded.hidden,
                ignored = 0,
                updated_at = excluded.updated_at
            ",
            (
                id.as_str(),
                name.as_str(),
                normalized_name.as_str(),
                bool_to_db(hidden),
                now.as_str(),
            ),
        )?;
        self.remember_project_sync_decision(
            &name,
            status,
            candidate
                .map(|candidate| candidate.jira_issue_keys.as_slice())
                .unwrap_or(&[]),
        )
    }

    fn remember_project_sync_decision(
        &self,
        name: &str,
        status: &str,
        jira_issue_keys: &[String],
    ) -> DbResult<()> {
        let display_name = normalize_display_name(name)?;
        let normalized_name = normalize_project_name(&display_name);
        let jira_issue_keys_json = serde_json::to_string(jira_issue_keys)
            .map_err(|error| DbError::InvalidData(error.to_string()))?;
        let now = utc_now_string()?;
        self.connection.execute(
            "
            INSERT INTO project_sync_decisions (
                normalized_name, display_name, status, jira_issue_keys_json, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(normalized_name) DO UPDATE SET
                display_name = excluded.display_name,
                status = excluded.status,
                jira_issue_keys_json = excluded.jira_issue_keys_json,
                updated_at = excluded.updated_at
            ",
            (
                normalized_name.as_str(),
                display_name.as_str(),
                status,
                jira_issue_keys_json.as_str(),
                now.as_str(),
            ),
        )?;
        Ok(())
    }

    pub fn sync_area_catalog(&self) -> DbResult<Vec<Category>> {
        let areas = OFFICIAL_AREAS
            .iter()
            .map(|area| SyncedCatalogArea {
                area_display_name: area.area_display_name.to_string(),
                jira_label: area.jira_label.to_string(),
                enabled_in_jtf: true,
                issue_type: "Story".to_string(),
                default_delivery_format: area.delivery_format.to_string(),
                safe_aliases: area
                    .aliases
                    .iter()
                    .map(|alias| (*alias).to_string())
                    .collect(),
                notes: String::new(),
            })
            .collect::<Vec<_>>();
        self.sync_area_catalog_entries(&areas)
    }

    pub fn sync_area_catalog_entries(
        &self,
        areas: &[SyncedCatalogArea],
    ) -> DbResult<Vec<Category>> {
        self.sync_area_catalog_contract(areas, &[], &[])
    }

    pub fn sync_area_catalog_contract(
        &self,
        areas: &[SyncedCatalogArea],
        delivery_formats: &[SyncedDeliveryFormat],
        area_format_rules: &[SyncedAreaFormatRule],
    ) -> DbResult<Vec<Category>> {
        let now = utc_now_string()?;
        self.connection.execute(
            "
            UPDATE categories
            SET ignored = 1, updated_at = ?1
            WHERE category_type = 'area'
            ",
            [now.as_str()],
        )?;
        self.connection
            .execute("DELETE FROM catalog_area_details", [])?;
        self.connection
            .execute("DELETE FROM catalog_delivery_formats", [])?;
        self.connection
            .execute("DELETE FROM catalog_area_format_rules", [])?;

        for catalog_area in areas {
            let id = Uuid::new_v4().to_string();
            let normalized_name = normalize_name(&catalog_area.area_display_name);
            let safe_aliases_json = serde_json::to_string(&catalog_area.safe_aliases)
                .map_err(|error| DbError::InvalidData(error.to_string()))?;
            self.connection.execute(
                "
                INSERT INTO categories (
                    id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at
                )
                VALUES (?1, 'area', ?2, ?3, 'catalog', 0, 0, ?4, ?4)
                ON CONFLICT(category_type, normalized_name) DO UPDATE SET
                    name = excluded.name,
                    source = 'catalog',
                    hidden = 0,
                    ignored = 0,
                    updated_at = excluded.updated_at
                ",
                (
                    id.as_str(),
                    catalog_area.area_display_name.as_str(),
                    normalized_name.as_str(),
                    now.as_str(),
                ),
            )?;
            self.connection.execute(
                "
                INSERT INTO catalog_area_details (
                    area_display_name, normalized_name, jira_label, issue_type,
                    default_delivery_format, safe_aliases_json, notes, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ",
                (
                    catalog_area.area_display_name.as_str(),
                    normalized_name.as_str(),
                    catalog_area.jira_label.as_str(),
                    catalog_area.issue_type.as_str(),
                    catalog_area.default_delivery_format.as_str(),
                    safe_aliases_json.as_str(),
                    catalog_area.notes.as_str(),
                    now.as_str(),
                ),
            )?;
        }

        for delivery_format in delivery_formats {
            let story_headings_json = serde_json::to_string(&delivery_format.story_headings)
                .map_err(|error| DbError::InvalidData(error.to_string()))?;
            let review_checklist_json = serde_json::to_string(&delivery_format.review_checklist)
                .map_err(|error| DbError::InvalidData(error.to_string()))?;
            self.connection.execute(
                "
                INSERT INTO catalog_delivery_formats (
                    format_name, normalized_name, issue_type, story_headings_json,
                    minimum_deliverable, review_checklist_json, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                ",
                (
                    delivery_format.format_name.as_str(),
                    normalize_name(&delivery_format.format_name).as_str(),
                    delivery_format.issue_type.as_str(),
                    story_headings_json.as_str(),
                    delivery_format.minimum_deliverable.as_str(),
                    review_checklist_json.as_str(),
                    now.as_str(),
                ),
            )?;
        }

        for rule in area_format_rules {
            let id = Uuid::new_v4().to_string();
            self.connection.execute(
                "
                INSERT INTO catalog_area_format_rules (
                    id, area_display_name, normalized_area_name, priority, condition,
                    normalized_condition, delivery_format, blocking, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ",
                (
                    id.as_str(),
                    rule.area_display_name.as_str(),
                    normalize_name(&rule.area_display_name).as_str(),
                    rule.order,
                    rule.condition.as_str(),
                    normalize_name(&rule.condition).as_str(),
                    rule.delivery_format.as_str(),
                    bool_to_db(rule.blocking),
                    now.as_str(),
                ),
            )?;
        }

        self.connection.execute(
            "
            DELETE FROM categories
            WHERE category_type = 'area' AND ignored = 1
            ",
            [],
        )?;

        self.list(Some("area"))
    }

    pub fn catalog_template_context_for_area(
        &self,
        area: &str,
        description_or_deliverable: &str,
    ) -> DbResult<Option<String>> {
        let normalized_area = normalize_name(area);
        let area_detail = self
            .connection
            .query_row(
                "
                SELECT area_display_name, jira_label, issue_type, default_delivery_format, notes
                FROM catalog_area_details
                WHERE normalized_name = ?1
                ",
                [normalized_area.as_str()],
                |row| {
                    Ok((
                        row.get::<_, String>("area_display_name")?,
                        row.get::<_, String>("jira_label")?,
                        row.get::<_, String>("issue_type")?,
                        row.get::<_, String>("default_delivery_format")?,
                        row.get::<_, String>("notes")?,
                    ))
                },
            )
            .optional()?;
        let Some((area_display_name, jira_label, issue_type, default_delivery_format, notes)) =
            area_detail
        else {
            return Ok(None);
        };
        let delivery_format = self.delivery_format_for_catalog_area(
            &area_display_name,
            &default_delivery_format,
            description_or_deliverable,
        )?;
        self.catalog_template_context_for_format(
            &area_display_name,
            &jira_label,
            &issue_type,
            &delivery_format,
            &notes,
        )
    }

    pub fn catalog_template_context_for_confirmed_delivery_format(
        &self,
        area: &str,
        delivery_format: &str,
    ) -> DbResult<Option<String>> {
        let normalized_area = normalize_name(area);
        let area_detail = self
            .connection
            .query_row(
                "
                SELECT area_display_name, jira_label, issue_type, notes
                FROM catalog_area_details
                WHERE normalized_name = ?1
                ",
                [normalized_area.as_str()],
                |row| {
                    Ok((
                        row.get::<_, String>("area_display_name")?,
                        row.get::<_, String>("jira_label")?,
                        row.get::<_, String>("issue_type")?,
                        row.get::<_, String>("notes")?,
                    ))
                },
            )
            .optional()?;
        let Some((area_display_name, jira_label, issue_type, notes)) = area_detail else {
            return Ok(None);
        };
        let valid_formats = self.catalog_delivery_format_options_for_area(&area_display_name)?;
        let normalized_delivery_format = normalize_name(delivery_format);
        if !valid_formats
            .iter()
            .any(|format| normalize_name(format) == normalized_delivery_format)
        {
            return Err(DbError::InvalidData(format!(
                "Delivery format must be one of the catalog formats mapped to {area_display_name}."
            )));
        }

        self.catalog_template_context_for_format(
            &area_display_name,
            &jira_label,
            &issue_type,
            delivery_format,
            &notes,
        )
    }

    pub fn catalog_delivery_format_options_for_area(&self, area: &str) -> DbResult<Vec<String>> {
        let normalized_area = normalize_name(area);
        let mut formats = Vec::new();

        let default_delivery_format = self
            .connection
            .query_row(
                "
                SELECT default_delivery_format
                FROM catalog_area_details
                WHERE normalized_name = ?1
                ",
                [normalized_area.as_str()],
                |row| row.get::<_, String>("default_delivery_format"),
            )
            .optional()?;
        if let Some(default_delivery_format) = default_delivery_format {
            push_unique_format(&mut formats, default_delivery_format);
        } else {
            return Ok(formats);
        }

        let mut statement = self.connection.prepare(
            "
            SELECT delivery_format
            FROM catalog_area_format_rules
            WHERE normalized_area_name = ?1
            ORDER BY priority ASC
            ",
        )?;
        let rule_formats = statement
            .query_map([normalized_area.as_str()], |row| {
                row.get::<_, String>("delivery_format")
            })?
            .collect::<Result<Vec<_>, _>>()?;
        for format in rule_formats {
            push_unique_format(&mut formats, format);
        }

        Ok(formats)
    }

    fn catalog_template_context_for_format(
        &self,
        area_display_name: &str,
        jira_label: &str,
        issue_type: &str,
        delivery_format: &str,
        notes: &str,
    ) -> DbResult<Option<String>> {
        let normalized_format = normalize_name(delivery_format);
        let format_detail = self
            .connection
            .query_row(
                "
                SELECT format_name, issue_type, story_headings_json, minimum_deliverable, review_checklist_json
                FROM catalog_delivery_formats
                WHERE normalized_name = ?1
                ",
                [normalized_format.as_str()],
                |row| {
                    Ok((
                        row.get::<_, String>("format_name")?,
                        row.get::<_, String>("issue_type")?,
                        row.get::<_, String>("story_headings_json")?,
                        row.get::<_, String>("minimum_deliverable")?,
                        row.get::<_, String>("review_checklist_json")?,
                    ))
                },
            )
            .optional()?;
        let Some((
            format_name,
            format_issue_type,
            story_headings_json,
            minimum_deliverable,
            review_checklist_json,
        )) = format_detail
        else {
            return Ok(None);
        };
        let story_headings = parse_string_array_json(&story_headings_json)?;
        let review_checklist = parse_string_array_json(&review_checklist_json)?;
        let checklist = if review_checklist.is_empty() {
            "- None".to_string()
        } else {
            review_checklist
                .iter()
                .map(|item| format!("- {item}"))
                .collect::<Vec<_>>()
                .join("\n")
        };
        let headings = if story_headings.is_empty() {
            "None".to_string()
        } else {
            story_headings.join(", ")
        };
        let notes = if notes.trim().is_empty() {
            "None".to_string()
        } else {
            notes.trim().to_string()
        };

        Ok(Some(format_catalog_template_context(
            CatalogTemplateContextParts {
                area_display_name,
                jira_label,
                issue_type,
                format_name: &format_name,
                format_issue_type: &format_issue_type,
                headings: &headings,
                minimum_deliverable: &minimum_deliverable,
                checklist: &checklist,
                notes: &notes,
            },
        )))
    }

    fn delivery_format_for_catalog_area(
        &self,
        area_display_name: &str,
        default_delivery_format: &str,
        description_or_deliverable: &str,
    ) -> DbResult<String> {
        let normalized_area = normalize_name(area_display_name);
        let normalized_context = normalize_name(description_or_deliverable);
        let mut statement = self.connection.prepare(
            "
            SELECT condition, normalized_condition, delivery_format, blocking
            FROM catalog_area_format_rules
            WHERE normalized_area_name = ?1
            ORDER BY priority ASC
            ",
        )?;
        let rules = statement
            .query_map([normalized_area.as_str()], |row| {
                Ok((
                    row.get::<_, String>("condition")?,
                    row.get::<_, String>("normalized_condition")?,
                    row.get::<_, String>("delivery_format")?,
                    row.get::<_, i64>("blocking")? != 0,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        for (condition, normalized_condition, delivery_format, blocking) in rules {
            if blocking || normalized_condition == "fallback" || normalized_condition.is_empty() {
                continue;
            }
            if normalized_context.contains(&normalized_condition)
                || normalized_context.contains(&normalize_name(&condition))
            {
                return Ok(delivery_format);
            }
        }

        Ok(default_delivery_format.to_string())
    }

    fn find_by_id(&self, id: &str) -> DbResult<Option<Category>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, category_type, name, source, hidden, ignored, created_at, updated_at
            FROM categories
            WHERE id = ?1
            ",
        )?;

        let result = statement.query_row([id], map_category_row);
        match result {
            Ok(category) => Ok(Some(category)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn ensure_defaults_seeded(&self) -> DbResult<()> {
        self.seed_category_type_if_empty("project", DEFAULT_PROJECT_CATEGORIES)?;
        self.seed_catalog_area_categories_if_empty()?;
        Ok(())
    }

    fn seed_category_type_if_empty(
        &self,
        category_type: &str,
        defaults: &[(&str, bool)],
    ) -> DbResult<()> {
        let count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM categories WHERE category_type = ?1",
            [category_type],
            |row| row.get(0),
        )?;
        if count > 0 {
            return Ok(());
        }

        let now = utc_now_string()?;
        for (name, hidden) in defaults {
            let id = Uuid::new_v4().to_string();
            let normalized_name = normalize_name(name);
            self.connection.execute(
                "
                INSERT OR IGNORE INTO categories (
                    id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, 'jira', ?5, 0, ?6, ?6)
                ",
                (
                    id.as_str(),
                    category_type,
                    *name,
                    normalized_name.as_str(),
                    bool_to_db(*hidden),
                    now.as_str(),
                ),
            )?;
        }

        Ok(())
    }

    fn seed_catalog_area_categories_if_empty(&self) -> DbResult<()> {
        let count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM categories WHERE category_type = 'area'",
            [],
            |row| row.get(0),
        )?;
        if count > 0 {
            return Ok(());
        }

        let now = utc_now_string()?;
        for catalog_area in OFFICIAL_AREAS {
            let id = Uuid::new_v4().to_string();
            let normalized_name = normalize_name(catalog_area.area_display_name);
            self.connection.execute(
                "
                INSERT OR IGNORE INTO categories (
                    id, category_type, name, normalized_name, source, hidden, ignored, created_at, updated_at
                )
                VALUES (?1, 'area', ?2, ?3, 'catalog', 0, 0, ?4, ?4)
                ",
                (
                    id.as_str(),
                    catalog_area.area_display_name,
                    normalized_name.as_str(),
                    now.as_str(),
                ),
            )?;
        }

        Ok(())
    }
}

impl<'connection> JqlFavoriteRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn list(&self) -> DbResult<Vec<JqlFavorite>> {
        self.ensure_defaults_seeded()?;
        let mut statement = self.connection.prepare(
            "
            SELECT id, name, jql, created_at, updated_at
            FROM jql_favorites
            ORDER BY updated_at DESC, created_at DESC
            ",
        )?;

        let favorites = statement
            .query_map([], map_jql_favorite_row)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DbError::from)?;
        Ok(favorites)
    }

    pub fn create(&self, name: &str, jql: &str) -> DbResult<JqlFavorite> {
        let name = normalize_display_name(name)?;
        let jql = normalize_jql(jql)?;
        let now = utc_now_string()?;
        let id = Uuid::new_v4().to_string();

        self.connection.execute(
            "
            INSERT INTO jql_favorites (id, name, jql, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?4)
            ",
            (id.as_str(), name.as_str(), jql.as_str(), now.as_str()),
        )?;

        self.find_by_id(&id)?
            .ok_or_else(|| DbError::InvalidData("JQL favorite was not created".to_string()))
    }

    pub fn update(
        &self,
        id: &str,
        name: Option<&str>,
        jql: Option<&str>,
    ) -> DbResult<Option<JqlFavorite>> {
        let Some(current) = self.find_by_id(id)? else {
            return Ok(None);
        };
        let next_name = match name {
            Some(name) => normalize_display_name(name)?,
            None => current.name,
        };
        let next_jql = match jql {
            Some(jql) => normalize_jql(jql)?,
            None => current.jql,
        };
        let now = utc_now_string()?;

        self.connection.execute(
            "
            UPDATE jql_favorites
            SET name = ?1, jql = ?2, updated_at = ?3
            WHERE id = ?4
            ",
            (next_name.as_str(), next_jql.as_str(), now.as_str(), id),
        )?;

        self.find_by_id(id)
    }

    pub fn delete(&self, id: &str) -> DbResult<bool> {
        let changed = self
            .connection
            .execute("DELETE FROM jql_favorites WHERE id = ?1", [id])?;
        Ok(changed > 0)
    }

    fn find_by_id(&self, id: &str) -> DbResult<Option<JqlFavorite>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, name, jql, created_at, updated_at
            FROM jql_favorites
            WHERE id = ?1
            ",
        )?;

        let result = statement.query_row([id], map_jql_favorite_row);
        match result {
            Ok(favorite) => Ok(Some(favorite)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn ensure_defaults_seeded(&self) -> DbResult<()> {
        let count: i64 =
            self.connection
                .query_row("SELECT COUNT(*) FROM jql_favorites", [], |row| row.get(0))?;
        if count > 0 {
            return Ok(());
        }

        let now = utc_now_string()?;
        for (name, jql) in DEFAULT_JQL_FAVORITES {
            let id = Uuid::new_v4().to_string();
            self.connection.execute(
                "
                INSERT INTO jql_favorites (id, name, jql, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?4)
                ",
                (id.as_str(), *name, *jql, now.as_str()),
            )?;
        }

        Ok(())
    }
}

impl<'connection> TaskRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn create(&self, new_task: NewTask) -> DbResult<LocalTask> {
        let now = utc_now_string()?;
        let task_order: i64 = self.connection.query_row(
            "SELECT COALESCE(MAX(task_order), -1) + 1 FROM tasks WHERE tray_id = ?1",
            [&new_task.tray_id],
            |row| row.get(0),
        )?;

        let task = LocalTask {
            id: Uuid::new_v4().to_string(),
            tray_id: new_task.tray_id,
            project: new_task.project,
            area: new_task.area,
            title: new_task.title,
            priority: new_task.priority,
            issue_type: new_task.issue_type,
            sync_status: "Pending".to_string(),
            description_status: "Missing".to_string(),
            description: None,
            content_language: new_task.content_language,
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            issue_relationships: Vec::new(),
            attachments: Vec::new(),
            task_order,
            created_at: now.clone(),
            updated_at: now,
        };

        self.connection.execute(
            "
            INSERT INTO tasks (
                id, tray_id, project, area, title, priority, issue_type, sync_status,
                description_status, description, content_language, jira_key, jira_url, epic_key,
                parent_task_id, task_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
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
                task.parent_task_id,
                task.task_order,
                task.created_at,
                task.updated_at
            ],
        )?;

        self.touch_tray(&task.tray_id, &task.updated_at)?;

        Ok(task)
    }

    pub fn create_subtask(&self, new_subtask: NewSubtask) -> DbResult<LocalTask> {
        let parent = self
            .find_by_id(&new_subtask.parent_task_id)?
            .ok_or_else(|| DbError::InvalidData("Sub-task parent was not found.".to_string()))?;
        if parent.issue_type == "Sub-task" {
            return Err(DbError::InvalidData(
                "Sub-tasks cannot be nested under another sub-task.".to_string(),
            ));
        }

        let title = normalize_display_name(&new_subtask.title)?;
        let now = utc_now_string()?;
        let task_order: i64 = self.connection.query_row(
            "SELECT COALESCE(MAX(task_order), -1) + 1 FROM tasks WHERE tray_id = ?1",
            [&parent.tray_id],
            |row| row.get(0),
        )?;

        let task = LocalTask {
            id: Uuid::new_v4().to_string(),
            tray_id: parent.tray_id.clone(),
            project: parent.project.clone(),
            area: parent.area.clone(),
            title,
            priority: parent.priority.clone(),
            issue_type: "Sub-task".to_string(),
            sync_status: "Pending".to_string(),
            description_status: "Ready".to_string(),
            description: None,
            content_language: parent.content_language.clone(),
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: Some(parent.id.clone()),
            issue_relationships: Vec::new(),
            attachments: Vec::new(),
            task_order,
            created_at: now.clone(),
            updated_at: now,
        };

        self.connection.execute(
            "
            INSERT INTO tasks (
                id, tray_id, project, area, title, priority, issue_type, sync_status,
                description_status, description, content_language, jira_key, jira_url, epic_key,
                parent_task_id, task_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
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
                task.parent_task_id,
                task.task_order,
                task.created_at,
                task.updated_at
            ],
        )?;

        self.touch_tray(&task.tray_id, &task.updated_at)?;

        Ok(task)
    }

    pub fn find_by_id(&self, task_id: &str) -> DbResult<Option<LocalTask>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, tray_id, project, area, title, priority, issue_type, sync_status,
                   description_status, description, content_language, jira_key, jira_url, epic_key,
                   parent_task_id, task_order, created_at, updated_at
            FROM tasks
            WHERE id = ?1
            ",
        )?;

        let result = statement.query_row([task_id], map_task_row);
        match result {
            Ok(task) => {
                let mut tasks = self.attach_issue_relationships(vec![task])?;
                Ok(tasks.pop())
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    pub fn list_for_tray(&self, tray_id: &str) -> DbResult<Vec<LocalTask>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, tray_id, project, area, title, priority, issue_type, sync_status,
                   description_status, description, content_language, jira_key, jira_url, epic_key,
                   parent_task_id, task_order, created_at, updated_at
            FROM tasks
            WHERE tray_id = ?1
            ORDER BY task_order ASC, created_at ASC
            ",
        )?;

        let tasks = statement
            .query_map([tray_id], map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;

        self.attach_issue_relationships(tasks)
    }

    pub fn list_all(&self) -> DbResult<Vec<LocalTask>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, tray_id, project, area, title, priority, issue_type, sync_status,
                   description_status, description, content_language, jira_key, jira_url, epic_key,
                   parent_task_id, task_order, created_at, updated_at
            FROM tasks
            ORDER BY tray_id ASC, task_order ASC, created_at ASC
            ",
        )?;

        let tasks = statement
            .query_map([], map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;

        self.attach_issue_relationships(tasks)
    }

    pub fn update_issue_relationships(
        &self,
        task_id: &str,
        relationships: &[LocalIssueRelationship],
    ) -> DbResult<Option<LocalTask>> {
        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, String>(0),
        );

        let Ok(tray_id) = tray_id else {
            return Ok(None);
        };

        let mut normalized_relationships = Vec::with_capacity(relationships.len());
        for relationship in relationships {
            validate_issue_relationship_type(&relationship.relationship_type)?;
            if relationship.target_task_id == task_id {
                return Err(DbError::InvalidData(
                    "Tasks cannot link a Jira relationship to themselves.".to_string(),
                ));
            }

            let target_tray_id = self.connection.query_row(
                "SELECT tray_id FROM tasks WHERE id = ?1",
                [relationship.target_task_id.as_str()],
                |row| row.get::<_, String>(0),
            );
            let Ok(target_tray_id) = target_tray_id else {
                return Err(DbError::InvalidData(
                    "Relationship target task was not found.".to_string(),
                ));
            };
            if target_tray_id != tray_id {
                return Err(DbError::InvalidData(
                    "Relationship target must belong to the same tray.".to_string(),
                ));
            }

            normalized_relationships.push(LocalIssueRelationship {
                id: normalize_relationship_id(&relationship.id),
                relationship_type: relationship.relationship_type.clone(),
                target_task_id: relationship.target_task_id.clone(),
            });
        }

        self.connection.execute(
            "DELETE FROM task_issue_relationships WHERE source_task_id = ?1",
            [task_id],
        )?;

        for relationship in &normalized_relationships {
            self.connection.execute(
                "
                INSERT INTO task_issue_relationships (
                    id, source_task_id, relationship_type, target_task_id, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ",
                (
                    relationship.id.as_str(),
                    task_id,
                    relationship.relationship_type.as_str(),
                    relationship.target_task_id.as_str(),
                    now.as_str(),
                ),
            )?;
        }

        self.touch_tray(&tray_id, &now)?;
        self.find_by_id(task_id)
    }

    pub fn create_attachment(&self, new_attachment: NewTaskAttachment) -> DbResult<TaskAttachment> {
        validate_attachment_purpose(&new_attachment.purpose)?;
        if new_attachment.original_size_bytes < 0 {
            return Err(DbError::InvalidData(
                "attachment size cannot be negative".to_string(),
            ));
        }
        let display_filename = normalize_display_name(&new_attachment.display_filename)?;
        let relative_path = validate_managed_relative_path(&new_attachment.original_relative_path)?;
        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [new_attachment.task_id.as_str()],
            |row| row.get::<_, String>(0),
        );
        let Ok(tray_id) = tray_id else {
            return Err(DbError::InvalidData(
                "Task must be editable before adding attachments.".to_string(),
            ));
        };

        let attachment = TaskAttachment {
            id: Uuid::new_v4().to_string(),
            task_id: new_attachment.task_id,
            display_filename,
            mime_type: normalize_optional_text(new_attachment.mime_type.as_deref()),
            purpose: new_attachment.purpose,
            original_size_bytes: new_attachment.original_size_bytes,
            original_relative_path: relative_path,
            size_label: format_byte_size(new_attachment.original_size_bytes),
            restore_status: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        self.connection.execute(
            "
            INSERT INTO attachments (
                id, task_id, display_filename, mime_type, purpose, original_size_bytes,
                original_relative_path, file_hash, restore_status, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8, ?9, ?10)
            ",
            params![
                attachment.id,
                attachment.task_id,
                attachment.display_filename,
                attachment.mime_type,
                attachment.purpose,
                attachment.original_size_bytes,
                attachment.original_relative_path,
                attachment.restore_status,
                attachment.created_at,
                attachment.updated_at
            ],
        )?;
        self.touch_tray(&tray_id, &now)?;
        Ok(attachment)
    }

    pub fn update_attachment_purpose(
        &self,
        task_id: &str,
        attachment_id: &str,
        purpose: &str,
    ) -> DbResult<Option<LocalTask>> {
        validate_attachment_purpose(purpose)?;
        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, String>(0),
        );
        let Ok(tray_id) = tray_id else {
            return Ok(None);
        };

        self.connection.execute(
            "
            UPDATE attachments
            SET purpose = ?1, updated_at = ?2
            WHERE id = ?3 AND task_id = ?4
            ",
            (purpose, now.as_str(), attachment_id, task_id),
        )?;
        self.touch_tray(&tray_id, &now)?;
        self.find_by_id(task_id)
    }

    pub fn delete_attachment(
        &self,
        task_id: &str,
        attachment_id: &str,
    ) -> DbResult<Option<LocalTask>> {
        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, String>(0),
        );
        let Ok(tray_id) = tray_id else {
            return Ok(None);
        };

        self.connection.execute(
            "DELETE FROM attachments WHERE id = ?1 AND task_id = ?2",
            (attachment_id, task_id),
        )?;
        self.touch_tray(&tray_id, &now)?;
        self.find_by_id(task_id)
    }

    pub fn attachment_paths_for_task_delete(&self, task_id: &str) -> DbResult<Option<Vec<String>>> {
        let task_exists = self.connection.query_row(
            "SELECT 1 FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, i64>(0),
        );
        if task_exists.is_err() {
            return Ok(None);
        }

        let created_child_count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM tasks WHERE parent_task_id = ?1 AND sync_status = 'Created'",
            [task_id],
            |row| row.get(0),
        )?;
        if created_child_count > 0 {
            return Ok(None);
        }

        self.attachment_paths_for_task_filter(
            "(tasks.id = ?1 OR tasks.parent_task_id = ?1) AND tasks.sync_status != 'Created'",
            task_id,
        )
        .map(Some)
    }

    pub fn attachment_paths_for_tray_delete(&self, tray_id: &str) -> DbResult<Vec<String>> {
        self.attachment_paths_for_task_filter("tasks.tray_id = ?1", tray_id)
    }

    pub fn list_jira_uploadable_attachments(&self, task_id: &str) -> DbResult<Vec<TaskAttachment>> {
        Ok(self
            .list_attachments_for_task(task_id)?
            .into_iter()
            .filter(|attachment| {
                matches!(
                    attachment.purpose.as_str(),
                    "Jira attachment" | "AI + Jira attachment"
                ) && attachment.restore_status.is_none()
            })
            .collect())
    }

    pub fn mark_attachment_bytes_cleaned(
        &self,
        task_id: &str,
        attachment_id: &str,
        cleanup_status: &str,
    ) -> DbResult<()> {
        let now = utc_now_string()?;
        self.connection.execute(
            "
            UPDATE attachments
            SET restore_status = ?1, updated_at = ?2
            WHERE id = ?3 AND task_id = ?4
            ",
            (cleanup_status, now.as_str(), attachment_id, task_id),
        )?;
        Ok(())
    }

    pub fn delete(&self, task_id: &str) -> DbResult<bool> {
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, String>(0),
        );

        let Ok(tray_id) = tray_id else {
            return Ok(false);
        };

        let created_child_count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM tasks WHERE parent_task_id = ?1 AND sync_status = 'Created'",
            [task_id],
            |row| row.get(0),
        )?;
        if created_child_count > 0 {
            return Ok(false);
        }

        let changed = self.connection.execute(
            "
            DELETE FROM tasks
            WHERE (id = ?1 OR parent_task_id = ?1)
              AND sync_status != 'Created'
            ",
            [task_id],
        )?;
        if changed > 0 {
            self.touch_tray(&tray_id, &utc_now_string()?)?;
        }

        Ok(changed > 0)
    }

    pub fn update_details(
        &self,
        task_id: &str,
        project: &str,
        area: &str,
        title: &str,
        priority: &str,
        issue_type: &str,
    ) -> DbResult<Option<LocalTask>> {
        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, String>(0),
        );

        let Ok(tray_id) = tray_id else {
            return Ok(None);
        };

        self.connection.execute(
            "
            UPDATE tasks
            SET project = ?1, area = ?2, title = ?3, priority = ?4, issue_type = ?5, updated_at = ?6
            WHERE id = ?7 AND sync_status != 'Created'
            ",
            (
                project,
                area,
                title,
                priority,
                issue_type,
                now.as_str(),
                task_id,
            ),
        )?;
        self.touch_tray(&tray_id, &now)?;

        Ok(self.list_all()?.into_iter().find(|task| task.id == task_id))
    }

    pub fn update_description(
        &self,
        task_id: &str,
        description: Option<&str>,
        description_status: &str,
    ) -> DbResult<Option<LocalTask>> {
        let status = description_status.trim();
        if !matches!(status, "Ready" | "Missing" | "Draft") {
            return Err(DbError::InvalidData(format!(
                "unknown description status: {status}"
            )));
        }

        let trimmed_description = description.map(str::trim).filter(|value| !value.is_empty());
        if status != "Missing" && trimmed_description.is_none() {
            return Err(DbError::InvalidData(
                "description is required before marking it ready or draft".to_string(),
            ));
        }

        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
            [task_id],
            |row| row.get::<_, String>(0),
        );

        let Ok(tray_id) = tray_id else {
            return Ok(None);
        };

        self.connection.execute(
            "
            UPDATE tasks
            SET description = ?1,
                description_status = ?2,
                updated_at = ?3
            WHERE id = ?4 AND sync_status != 'Created'
            ",
            (trimmed_description, status, now.as_str(), task_id),
        )?;
        self.touch_tray(&tray_id, &now)?;

        self.find_by_id(task_id)
    }

    pub fn mark_csv_exported(&self, task_ids: &[String]) -> DbResult<Vec<LocalTask>> {
        if task_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = utc_now_string()?;
        for task_id in task_ids {
            self.connection.execute(
                "
                UPDATE tasks
                SET sync_status = 'Exported', updated_at = ?1
                WHERE id = ?2 AND sync_status IN ('Pending', 'Failed')
                ",
                (now.as_str(), task_id.as_str()),
            )?;
        }

        let tasks = self.list_all()?;
        let exported_tasks = task_ids
            .iter()
            .filter_map(|task_id| tasks.iter().find(|task| task.id == *task_id).cloned())
            .collect::<Vec<_>>();

        let mut touched_tray_ids = Vec::<String>::new();
        for task in &exported_tasks {
            if !touched_tray_ids.contains(&task.tray_id) {
                touched_tray_ids.push(task.tray_id.clone());
            }
        }

        for tray_id in touched_tray_ids {
            self.touch_tray(&tray_id, &now)?;
        }

        Ok(exported_tasks)
    }

    pub fn mark_jira_created(
        &self,
        task_id: &str,
        jira_key: &str,
        jira_url: &str,
        epic_key: &str,
    ) -> DbResult<Option<LocalTask>> {
        let now = utc_now_string()?;
        let Some(current_task) = self.find_by_id(task_id)? else {
            return Ok(None);
        };
        if current_task.sync_status == "Created" {
            return Ok(Some(current_task));
        }

        self.connection.execute(
            "
            UPDATE tasks
            SET sync_status = 'Created',
                jira_key = ?1,
                jira_url = ?2,
                epic_key = ?3,
                updated_at = ?4
            WHERE id = ?5
            ",
            (jira_key, jira_url, epic_key, now.as_str(), task_id),
        )?;
        self.touch_tray(&current_task.tray_id, &now)?;

        Ok(self.list_all()?.into_iter().find(|task| task.id == task_id))
    }

    pub fn mark_jira_subtask_created(
        &self,
        task_id: &str,
        jira_key: &str,
        jira_url: &str,
    ) -> DbResult<Option<LocalTask>> {
        let now = utc_now_string()?;
        let Some(current_task) = self.find_by_id(task_id)? else {
            return Ok(None);
        };
        if current_task.sync_status == "Created" {
            return Ok(Some(current_task));
        }

        self.connection.execute(
            "
            UPDATE tasks
            SET sync_status = 'Created',
                jira_key = ?1,
                jira_url = ?2,
                epic_key = NULL,
                updated_at = ?3
            WHERE id = ?4
            ",
            (jira_key, jira_url, now.as_str(), task_id),
        )?;
        self.touch_tray(&current_task.tray_id, &now)?;

        Ok(self.list_all()?.into_iter().find(|task| task.id == task_id))
    }

    pub fn mark_jira_failed(&self, task_id: &str) -> DbResult<Option<LocalTask>> {
        let now = utc_now_string()?;
        let tray_id = self.connection.query_row(
            "SELECT tray_id FROM tasks WHERE id = ?1",
            [task_id],
            |row| row.get::<_, String>(0),
        );

        let Ok(tray_id) = tray_id else {
            return Ok(None);
        };

        self.connection.execute(
            "
            UPDATE tasks
            SET sync_status = 'Failed', updated_at = ?1
            WHERE id = ?2 AND sync_status != 'Created'
            ",
            (now.as_str(), task_id),
        )?;
        self.touch_tray(&tray_id, &now)?;

        Ok(self.list_all()?.into_iter().find(|task| task.id == task_id))
    }

    pub fn move_tasks_to_tray(
        &self,
        task_ids: &[String],
        target_tray_id: &str,
    ) -> DbResult<Vec<LocalTask>> {
        if task_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = utc_now_string()?;
        let mut touched_tray_ids = vec![target_tray_id.to_string()];
        let mut moved_task_ids = Vec::<String>::new();
        let mut next_order: i64 = self.connection.query_row(
            "SELECT COALESCE(MAX(task_order), -1) + 1 FROM tasks WHERE tray_id = ?1",
            [target_tray_id],
            |row| row.get(0),
        )?;

        for task_id in task_ids {
            let source_tray_id = self.connection.query_row(
                "SELECT tray_id FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
                [task_id.as_str()],
                |row| row.get::<_, String>(0),
            );
            let Ok(source_tray_id) = source_tray_id else {
                continue;
            };

            self.connection.execute(
                "
                UPDATE tasks
                SET tray_id = ?1, task_order = ?2, updated_at = ?3
                WHERE id = ?4 AND sync_status != 'Created'
                ",
                (target_tray_id, next_order, now.as_str(), task_id.as_str()),
            )?;
            next_order += 1;
            moved_task_ids.push(task_id.clone());
            if !touched_tray_ids.contains(&source_tray_id) {
                touched_tray_ids.push(source_tray_id);
            }
        }

        for tray_id in touched_tray_ids {
            self.touch_tray(&tray_id, &now)?;
        }

        let tasks = self.list_all()?;
        Ok(moved_task_ids
            .iter()
            .filter_map(|task_id| tasks.iter().find(|task| task.id == *task_id).cloned())
            .collect())
    }

    fn touch_tray(&self, tray_id: &str, updated_at: &str) -> DbResult<()> {
        self.connection.execute(
            "
            UPDATE trays
            SET updated_at = ?1,
                state = CASE
                    WHEN state = 'Archived' THEN state
                    WHEN NOT EXISTS (
                        SELECT 1 FROM tasks WHERE tray_id = ?2
                    ) THEN 'Active'
                    WHEN EXISTS (
                        SELECT 1 FROM tasks WHERE tray_id = ?2 AND sync_status = 'Failed'
                    ) THEN 'Needs attention'
                    WHEN NOT EXISTS (
                        SELECT 1 FROM tasks WHERE tray_id = ?2 AND sync_status != 'Created'
                    ) THEN 'Completed'
                    ELSE 'Active'
                END
            WHERE id = ?2
            ",
            (updated_at, tray_id),
        )?;
        Ok(())
    }

    fn attach_issue_relationships(&self, mut tasks: Vec<LocalTask>) -> DbResult<Vec<LocalTask>> {
        for task in &mut tasks {
            task.issue_relationships = self.list_issue_relationships_for_task(&task.id)?;
            task.attachments = self.list_attachments_for_task(&task.id)?;
        }
        Ok(tasks)
    }

    fn list_issue_relationships_for_task(
        &self,
        task_id: &str,
    ) -> DbResult<Vec<LocalIssueRelationship>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, relationship_type, target_task_id
            FROM task_issue_relationships
            WHERE source_task_id = ?1
            ORDER BY created_at ASC, id ASC
            ",
        )?;

        let relationships = statement
            .query_map([task_id], map_issue_relationship_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(relationships)
    }

    fn list_attachments_for_task(&self, task_id: &str) -> DbResult<Vec<TaskAttachment>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, task_id, display_filename, mime_type, purpose, original_size_bytes,
                   original_relative_path, restore_status, created_at, updated_at
            FROM attachments
            WHERE task_id = ?1
            ORDER BY created_at ASC, id ASC
            ",
        )?;

        let attachments = statement
            .query_map([task_id], map_attachment_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(attachments)
    }

    fn attachment_paths_for_task_filter(
        &self,
        filter_sql: &str,
        value: &str,
    ) -> DbResult<Vec<String>> {
        let mut statement = self.connection.prepare(&format!(
            "
            SELECT attachments.original_relative_path
            FROM attachments
            JOIN tasks ON tasks.id = attachments.task_id
            WHERE {filter_sql}
            UNION ALL
            SELECT attachment_variants.relative_path
            FROM attachment_variants
            JOIN attachments ON attachments.id = attachment_variants.attachment_id
            JOIN tasks ON tasks.id = attachments.task_id
            WHERE {filter_sql}
            "
        ))?;
        let paths = statement
            .query_map([value], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DbError::from)?;
        Ok(paths)
    }
}

impl<'connection> AssistedDescriptionProposalRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn create(
        &self,
        new_proposal: NewAssistedDescriptionProposal,
    ) -> DbResult<AssistedDescriptionProposal> {
        if !self.task_exists(&new_proposal.task_id)? {
            return Err(DbError::InvalidData("Task not found.".to_string()));
        }

        let now = utc_now_string()?;
        let proposal = AssistedDescriptionProposal {
            id: Uuid::new_v4().to_string(),
            task_id: new_proposal.task_id,
            title: normalize_optional_text(new_proposal.title.as_deref())
                .unwrap_or_else(|| "Assisted description proposal".to_string()),
            summary: normalize_optional_text(new_proposal.summary.as_deref()),
            status: AssistedDescriptionProposalStatus::Pending,
            provider: normalize_optional_text(new_proposal.provider.as_deref()),
            model: normalize_optional_text(new_proposal.model.as_deref()),
            user_comment: normalize_optional_text(new_proposal.user_comment.as_deref()),
            sections: normalize_proposal_sections(new_proposal.sections, &now)?,
            created_at: now.clone(),
            updated_at: now,
            decided_at: None,
        };
        let sections_json = proposal_sections_json(&proposal.sections)?;

        self.connection.execute(
            "
            INSERT INTO assisted_description_proposals (
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

        self.record_log_entry(
            &proposal,
            "description.proposal.created",
            proposal.user_comment.as_deref(),
            serde_json::json!({
                "sectionCount": proposal.sections.len(),
                "polishedSectionCount": polished_section_count(&proposal.sections),
            }),
        )?;

        Ok(proposal)
    }

    pub fn list_for_task(&self, task_id: &str) -> DbResult<Vec<AssistedDescriptionProposal>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, task_id, title, summary, status, provider, model, user_comment,
                   sections_json, created_at, updated_at, decided_at
            FROM assisted_description_proposals
            WHERE task_id = ?1
            ORDER BY created_at DESC, id DESC
            ",
        )?;

        let proposals = statement
            .query_map([task_id], map_assisted_description_proposal_row)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DbError::from)?;

        Ok(proposals)
    }

    pub fn list_log_for_task(&self, task_id: &str) -> DbResult<Vec<DescriptionProposalLogEntry>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, task_id, proposal_id, event_type, title, summary, status, provider,
                   model, user_comment, detail_json, occurred_at
            FROM description_proposal_log_entries
            WHERE task_id = ?1
            ORDER BY occurred_at ASC, id ASC
            ",
        )?;

        let entries = statement
            .query_map([task_id], map_description_proposal_log_row)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(DbError::from)?;

        Ok(entries)
    }

    pub fn update_section(
        &self,
        proposal_id: &str,
        section_id: &str,
        proposed_content: Option<&str>,
        status: Option<DescriptionSectionStatus>,
        reviewer_comment: Option<&str>,
        apply_to_task_description: bool,
    ) -> DbResult<Option<AssistedDescriptionProposal>> {
        validate_assisted_description_section_id(section_id)?;
        let Some(mut proposal) = self.find_by_id(proposal_id)? else {
            return Ok(None);
        };

        let now = utc_now_string()?;
        let reviewer_comment = normalize_optional_text(reviewer_comment);
        let proposed_content_changed = proposed_content.is_some();
        let mut section_found = false;
        for section in &mut proposal.sections {
            if section.section_id != section_id {
                continue;
            }

            if let Some(proposed_content) = proposed_content {
                section.proposed_content = proposed_content.trim().to_string();
            }
            if let Some(status) = status {
                section.status = status;
            }
            if proposed_content_changed {
                section.reviewer_comment = reviewer_comment
                    .clone()
                    .or_else(|| section.reviewer_comment.clone());
            }
            section.updated_at = Some(now.clone());
            section_found = true;
            break;
        }

        if !section_found {
            return Err(DbError::InvalidData(format!(
                "proposal is missing assisted description section: {section_id}"
            )));
        }

        proposal.sections = normalize_proposal_sections(proposal.sections, &now)?;
        proposal.updated_at = now.clone();
        self.update_proposal_sections(&proposal)?;
        let should_apply = apply_to_task_description
            || status.is_some_and(|status| status == DescriptionSectionStatus::Polished);
        if should_apply {
            self.apply_sections_to_task_description(&proposal.task_id, &proposal.sections)?;
        }
        self.record_log_entry(
            &proposal,
            "description.proposal.section_updated",
            reviewer_comment.as_deref(),
            serde_json::json!({
                "sectionId": section_id,
                "applyToTaskDescription": should_apply,
                "polishedSectionCount": polished_section_count(&proposal.sections),
            }),
        )?;

        self.find_by_id(proposal_id)
    }

    pub fn transition(
        &self,
        proposal_id: &str,
        status: AssistedDescriptionProposalStatus,
        reviewer_comment: Option<&str>,
        apply_to_task_description: bool,
    ) -> DbResult<Option<AssistedDescriptionProposal>> {
        let Some(mut proposal) = self.find_by_id(proposal_id)? else {
            return Ok(None);
        };

        let now = utc_now_string()?;
        if status == AssistedDescriptionProposalStatus::Accepted {
            for section in &mut proposal.sections {
                if !section.proposed_content.trim().is_empty() {
                    section.status = DescriptionSectionStatus::Polished;
                    section.updated_at = Some(now.clone());
                }
            }
        }

        proposal.sections = normalize_proposal_sections(proposal.sections, &now)?;
        proposal.status = status;
        proposal.updated_at = now.clone();
        proposal.decided_at = if status == AssistedDescriptionProposalStatus::Pending {
            None
        } else {
            Some(now)
        };

        self.connection.execute(
            "
            UPDATE assisted_description_proposals
            SET status = ?1,
                sections_json = ?2,
                updated_at = ?3,
                decided_at = ?4
            WHERE id = ?5
            ",
            params![
                proposal.status.as_db_value(),
                proposal_sections_json(&proposal.sections)?,
                proposal.updated_at,
                proposal.decided_at,
                proposal.id
            ],
        )?;

        let should_apply = matches!(
            status,
            AssistedDescriptionProposalStatus::Accepted
                | AssistedDescriptionProposalStatus::Partial
        );
        if should_apply {
            self.apply_sections_to_task_description(&proposal.task_id, &proposal.sections)?;
        }
        self.record_log_entry(
            &proposal,
            "description.proposal.status_changed",
            normalize_optional_text(reviewer_comment).as_deref(),
            serde_json::json!({
                "status": proposal.status.as_db_value(),
                "applyToTaskDescription": should_apply,
                "requestedApplyToTaskDescription": apply_to_task_description,
                "polishedSectionCount": polished_section_count(&proposal.sections),
            }),
        )?;

        self.find_by_id(proposal_id)
    }

    pub fn delete(&self, proposal_id: &str) -> DbResult<bool> {
        let Some(proposal) = self.find_by_id(proposal_id)? else {
            return Ok(false);
        };

        self.record_log_entry(
            &proposal,
            "description.proposal.deleted",
            None,
            serde_json::json!({}),
        )?;
        let changed = self.connection.execute(
            "DELETE FROM assisted_description_proposals WHERE id = ?1",
            [proposal_id],
        )?;
        Ok(changed > 0)
    }

    fn find_by_id(&self, proposal_id: &str) -> DbResult<Option<AssistedDescriptionProposal>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, task_id, title, summary, status, provider, model, user_comment,
                   sections_json, created_at, updated_at, decided_at
            FROM assisted_description_proposals
            WHERE id = ?1
            ",
        )?;

        let result = statement.query_row([proposal_id], map_assisted_description_proposal_row);
        match result {
            Ok(proposal) => Ok(Some(proposal)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn update_proposal_sections(&self, proposal: &AssistedDescriptionProposal) -> DbResult<()> {
        self.connection.execute(
            "
            UPDATE assisted_description_proposals
            SET sections_json = ?1, updated_at = ?2
            WHERE id = ?3
            ",
            (
                proposal_sections_json(&proposal.sections)?.as_str(),
                proposal.updated_at.as_str(),
                proposal.id.as_str(),
            ),
        )?;
        Ok(())
    }

    fn record_log_entry(
        &self,
        proposal: &AssistedDescriptionProposal,
        event_type: &str,
        user_comment: Option<&str>,
        detail: Value,
    ) -> DbResult<()> {
        let entry_id = Uuid::new_v4().to_string();
        let occurred_at = utc_now_string()?;
        let detail_json = serde_json::to_string(&detail)
            .map_err(|error| DbError::InvalidData(error.to_string()))?;
        let user_comment = normalize_optional_text(user_comment);

        self.connection.execute(
            "
            INSERT INTO description_proposal_log_entries (
                id, task_id, proposal_id, event_type, title, summary, status, provider,
                model, user_comment, detail_json, occurred_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ",
            params![
                entry_id,
                proposal.task_id,
                proposal.id,
                event_type,
                proposal.title,
                proposal.summary,
                proposal.status.as_db_value(),
                proposal.provider,
                proposal.model,
                user_comment,
                detail_json,
                occurred_at
            ],
        )?;
        Ok(())
    }

    fn apply_sections_to_task_description(
        &self,
        task_id: &str,
        sections: &[AssistedDescriptionProposalSection],
    ) -> DbResult<()> {
        let description = render_assisted_description_from_sections(sections);
        let trimmed = description.trim();
        let description = if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        };
        let status = if description.is_some() {
            "Ready"
        } else {
            "Missing"
        };

        TaskRepository::new(self.connection).update_description(task_id, description, status)?;
        Ok(())
    }

    fn task_exists(&self, task_id: &str) -> DbResult<bool> {
        self.connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tasks WHERE id = ?1)",
                [task_id],
                |row| row.get(0),
            )
            .map_err(DbError::from)
    }
}

impl<'connection> SyncRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn start_attempt(&self, tray_id: &str, trigger: &str) -> DbResult<String> {
        let attempt_id = Uuid::new_v4().to_string();
        let now = utc_now_string()?;

        self.connection.execute(
            "
            INSERT INTO sync_attempts (id, tray_id, started_at, finished_at, status, trigger)
            VALUES (?1, ?2, ?3, NULL, 'running', ?4)
            ",
            (attempt_id.as_str(), tray_id, now.as_str(), trigger),
        )?;

        Ok(attempt_id)
    }

    pub fn finish_attempt(&self, attempt_id: &str, status: &str) -> DbResult<()> {
        let now = utc_now_string()?;
        self.connection.execute(
            "
            UPDATE sync_attempts
            SET finished_at = ?1, status = ?2
            WHERE id = ?3
            ",
            (now.as_str(), status, attempt_id),
        )?;
        Ok(())
    }

    pub fn record_event(
        &self,
        sync_attempt_id: &str,
        tray_id: &str,
        task_id: Option<&str>,
        event_type: &str,
        outcome: &str,
        operation: &str,
        detail: SyncAuditDetail,
    ) -> DbResult<()> {
        let event_id = Uuid::new_v4().to_string();
        let occurred_at = utc_now_string()?;
        let detail_json = serde_json::to_string(detail.as_value())
            .map_err(|error| DbError::InvalidData(error.to_string()))?;

        self.connection.execute(
            "
            INSERT INTO sync_audit_events (
                id, sync_attempt_id, tray_id, task_id, event_type, occurred_at,
                outcome, provider, operation, detail_json
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'jira', ?8, ?9)
            ",
            (
                event_id.as_str(),
                sync_attempt_id,
                tray_id,
                task_id,
                event_type,
                occurred_at.as_str(),
                outcome,
                operation,
                detail_json.as_str(),
            ),
        )?;

        Ok(())
    }

    pub fn list_for_task(&self, task_id: &str) -> DbResult<Vec<SyncAuditEvent>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, sync_attempt_id, tray_id, task_id, event_type, occurred_at,
                   outcome, provider, operation, detail_json
            FROM sync_audit_events
            WHERE task_id = ?1
            ORDER BY occurred_at DESC, id DESC
            ",
        )?;

        let events = statement
            .query_map([task_id], map_sync_audit_event_row)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(events)
    }
}

fn map_sync_audit_event_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SyncAuditEvent> {
    let detail_json: String = row.get("detail_json")?;
    let detail = serde_json::from_str(&detail_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            detail_json.len(),
            rusqlite::types::Type::Text,
            Box::new(DbError::InvalidData(error.to_string())),
        )
    })?;

    Ok(SyncAuditEvent {
        id: row.get("id")?,
        sync_attempt_id: row.get("sync_attempt_id")?,
        tray_id: row.get("tray_id")?,
        task_id: row.get("task_id")?,
        event_type: row.get("event_type")?,
        occurred_at: row.get("occurred_at")?,
        outcome: row.get("outcome")?,
        provider: row.get("provider")?,
        operation: row.get("operation")?,
        detail,
    })
}

fn map_assisted_description_proposal_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<AssistedDescriptionProposal> {
    let status_value: String = row.get("status")?;
    let status =
        AssistedDescriptionProposalStatus::from_db_value(&status_value).map_err(|message| {
            rusqlite::Error::FromSqlConversionFailure(
                status_value.len(),
                rusqlite::types::Type::Text,
                Box::new(DbError::InvalidData(message)),
            )
        })?;
    let sections_json: String = row.get("sections_json")?;
    let sections = serde_json::from_str(&sections_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            sections_json.len(),
            rusqlite::types::Type::Text,
            Box::new(DbError::InvalidData(error.to_string())),
        )
    })?;

    Ok(AssistedDescriptionProposal {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        title: row.get("title")?,
        summary: row.get("summary")?,
        status,
        provider: row.get("provider")?,
        model: row.get("model")?,
        user_comment: row.get("user_comment")?,
        sections,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        decided_at: row.get("decided_at")?,
    })
}

fn map_description_proposal_log_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<DescriptionProposalLogEntry> {
    let status_value: String = row.get("status")?;
    let status =
        AssistedDescriptionProposalStatus::from_db_value(&status_value).map_err(|message| {
            rusqlite::Error::FromSqlConversionFailure(
                status_value.len(),
                rusqlite::types::Type::Text,
                Box::new(DbError::InvalidData(message)),
            )
        })?;
    let detail_json: String = row.get("detail_json")?;
    let detail = serde_json::from_str(&detail_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            detail_json.len(),
            rusqlite::types::Type::Text,
            Box::new(DbError::InvalidData(error.to_string())),
        )
    })?;

    Ok(DescriptionProposalLogEntry {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        proposal_id: row.get("proposal_id")?,
        event_type: row.get("event_type")?,
        title: row.get("title")?,
        summary: row.get("summary")?,
        status,
        provider: row.get("provider")?,
        model: row.get("model")?,
        user_comment: row.get("user_comment")?,
        detail,
        occurred_at: row.get("occurred_at")?,
    })
}

fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalTask> {
    Ok(LocalTask {
        id: row.get("id")?,
        tray_id: row.get("tray_id")?,
        project: row.get("project")?,
        area: row.get("area")?,
        title: row.get("title")?,
        priority: row.get("priority")?,
        issue_type: row.get("issue_type")?,
        sync_status: row.get("sync_status")?,
        description_status: row.get("description_status")?,
        description: row.get("description")?,
        content_language: row.get("content_language")?,
        jira_key: row.get("jira_key")?,
        jira_url: row.get("jira_url")?,
        epic_key: row.get("epic_key")?,
        parent_task_id: row.get("parent_task_id")?,
        issue_relationships: Vec::new(),
        attachments: Vec::new(),
        task_order: row.get("task_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_tray_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Tray> {
    let state_value: String = row.get("state")?;
    let state = TrayState::from_db_value(&state_value).map_err(|message| {
        rusqlite::Error::FromSqlConversionFailure(
            state_value.len(),
            rusqlite::types::Type::Text,
            Box::new(DbError::InvalidData(message)),
        )
    })?;

    Ok(Tray {
        id: row.get("id")?,
        name: row.get("name")?,
        state,
        epic_scope: row.get("epic_scope")?,
        transversal_epic_scope: row.get("transversal_epic_scope")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        archived_at: row.get("archived_at")?,
    })
}

fn map_issue_relationship_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalIssueRelationship> {
    Ok(LocalIssueRelationship {
        id: row.get("id")?,
        relationship_type: row.get("relationship_type")?,
        target_task_id: row.get("target_task_id")?,
    })
}

fn map_attachment_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskAttachment> {
    let original_size_bytes = row.get("original_size_bytes")?;
    Ok(TaskAttachment {
        id: row.get("id")?,
        task_id: row.get("task_id")?,
        display_filename: row.get("display_filename")?,
        mime_type: row.get("mime_type")?,
        purpose: row.get("purpose")?,
        original_size_bytes,
        original_relative_path: row.get("original_relative_path")?,
        size_label: format_byte_size(original_size_bytes),
        restore_status: row.get("restore_status")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_category_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get("id")?,
        category_type: row.get("category_type")?,
        name: row.get("name")?,
        source: row.get("source")?,
        hidden: row.get::<_, i64>("hidden")? != 0,
        ignored: row.get::<_, i64>("ignored")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_jql_favorite_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<JqlFavorite> {
    Ok(JqlFavorite {
        id: row.get("id")?,
        name: row.get("name")?,
        jql: row.get("jql")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn validate_category_type(category_type: &str) -> DbResult<()> {
    match category_type {
        "project" | "area" => Ok(()),
        _ => Err(DbError::InvalidData(format!(
            "unknown category type: {category_type}"
        ))),
    }
}

fn validate_issue_relationship_type(relationship_type: &str) -> DbResult<()> {
    match relationship_type {
        "blocks" | "blocked_by" => Ok(()),
        _ => Err(DbError::InvalidData(format!(
            "unknown issue relationship type: {relationship_type}"
        ))),
    }
}

fn validate_attachment_purpose(purpose: &str) -> DbResult<()> {
    match purpose {
        "AI only" | "Jira attachment" | "AI + Jira attachment" => Ok(()),
        _ => Err(DbError::InvalidData(format!(
            "unknown attachment purpose: {purpose}"
        ))),
    }
}

fn format_byte_size(size_bytes: i64) -> String {
    if size_bytes < 1024 {
        return format!("{size_bytes} B");
    }
    let kib = size_bytes as f64 / 1024.0;
    if kib < 1024.0 {
        return format!("{kib:.1} KB");
    }
    let mib = kib / 1024.0;
    if mib < 1024.0 {
        return format!("{mib:.1} MB");
    }
    let gib = mib / 1024.0;
    format!("{gib:.1} GB")
}

fn normalize_relationship_id(id: &str) -> String {
    let trimmed_id = id.trim();
    if trimmed_id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        trimmed_id.to_string()
    }
}

fn normalize_display_name(name: &str) -> DbResult<String> {
    let normalized = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err(DbError::InvalidData("name is required".to_string()));
    }
    Ok(normalized)
}

fn normalize_optional_epic_scope(scope: Option<&str>) -> DbResult<Option<String>> {
    Ok(normalize_epic_scope(scope))
}

fn normalize_jql(jql: &str) -> DbResult<String> {
    let normalized = jql.trim().to_string();
    if normalized.is_empty() {
        return Err(DbError::InvalidData("JQL is required".to_string()));
    }
    Ok(normalized)
}

fn normalize_name(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

struct CatalogTemplateContextParts<'a> {
    area_display_name: &'a str,
    jira_label: &'a str,
    issue_type: &'a str,
    format_name: &'a str,
    format_issue_type: &'a str,
    headings: &'a str,
    minimum_deliverable: &'a str,
    checklist: &'a str,
    notes: &'a str,
}

fn format_catalog_template_context(parts: CatalogTemplateContextParts<'_>) -> String {
    [
        "Synced Notion catalog template:".to_string(),
        format!("- Official area display name: {}", parts.area_display_name),
        format!("- Jira label: {}", parts.jira_label),
        format!("- Area issue type: {}", parts.issue_type),
        format!("- Delivery format: {}", parts.format_name),
        format!("- Delivery format issue type: {}", parts.format_issue_type),
        format!("- Required story headings: {}", parts.headings),
        format!("- Minimum deliverable: {}", parts.minimum_deliverable),
        "- Review checklist:".to_string(),
        parts.checklist.to_string(),
        format!("- Area notes: {}", parts.notes),
    ]
    .join("\n")
}

fn push_unique_format(formats: &mut Vec<String>, format: String) {
    let format = format.trim();
    if format.is_empty() {
        return;
    }
    if formats
        .iter()
        .any(|existing| normalize_name(existing) == normalize_name(format))
    {
        return;
    }
    formats.push(format.to_string());
}

fn bool_to_db(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn parse_string_array_json(value: &str) -> DbResult<Vec<String>> {
    serde_json::from_str::<Vec<String>>(value)
        .map_err(|error| DbError::InvalidData(error.to_string()))
}

fn normalize_proposal_sections(
    sections: Vec<AssistedDescriptionProposalSection>,
    updated_at: &str,
) -> DbResult<Vec<AssistedDescriptionProposalSection>> {
    for section in &sections {
        validate_assisted_description_section_id(&section.section_id)?;
    }

    ASSISTED_DESCRIPTION_SECTION_DEFINITIONS
        .iter()
        .map(|(section_id, heading)| {
            let incoming = sections
                .iter()
                .find(|section| section.section_id == *section_id);
            let current_content = incoming
                .map(|section| section.current_content.trim().to_string())
                .unwrap_or_default();
            let proposed_content = incoming
                .map(|section| section.proposed_content.trim().to_string())
                .unwrap_or_default();
            let status = incoming
                .map(|section| section.status)
                .unwrap_or(DescriptionSectionStatus::Raw);
            let reviewer_comment = incoming
                .and_then(|section| normalize_optional_text(section.reviewer_comment.as_deref()));

            Ok(AssistedDescriptionProposalSection {
                section_id: (*section_id).to_string(),
                heading: incoming
                    .map(|section| section.heading.trim().to_string())
                    .filter(|heading| !heading.is_empty())
                    .unwrap_or_else(|| (*heading).to_string()),
                current_content,
                proposed_content,
                status,
                reviewer_comment,
                updated_at: incoming
                    .and_then(|section| section.updated_at.clone())
                    .or_else(|| Some(updated_at.to_string())),
            })
        })
        .collect()
}

fn validate_assisted_description_section_id(section_id: &str) -> DbResult<()> {
    if ASSISTED_DESCRIPTION_SECTION_DEFINITIONS
        .iter()
        .any(|(fixed_section_id, _)| *fixed_section_id == section_id)
    {
        Ok(())
    } else {
        Err(DbError::InvalidData(format!(
            "unknown assisted description section: {section_id}"
        )))
    }
}

fn proposal_sections_json(sections: &[AssistedDescriptionProposalSection]) -> DbResult<String> {
    serde_json::to_string(sections).map_err(|error| DbError::InvalidData(error.to_string()))
}

fn polished_section_count(sections: &[AssistedDescriptionProposalSection]) -> usize {
    sections
        .iter()
        .filter(|section| {
            section.status == DescriptionSectionStatus::Polished
                && !section.proposed_content.trim().is_empty()
        })
        .count()
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn render_assisted_description_from_sections(
    sections: &[AssistedDescriptionProposalSection],
) -> String {
    let mut parts = Vec::new();
    for section in sections {
        let Some(content) = accepted_or_current_section_content(section) else {
            continue;
        };
        parts.push(format!("## {}\n\n{content}", section.heading));
    }

    parts.join("\n\n")
}

fn accepted_or_current_section_content(
    section: &AssistedDescriptionProposalSection,
) -> Option<&str> {
    let content = if section.status == DescriptionSectionStatus::Polished {
        section.proposed_content.trim()
    } else {
        section.current_content.trim()
    };

    if content.is_empty() {
        None
    } else {
        Some(content)
    }
}

impl<'connection> TrayRepository<'connection> {
    pub fn new(connection: &'connection Connection) -> Self {
        Self { connection }
    }

    pub fn create(&self, new_tray: NewTray) -> DbResult<Tray> {
        let now = utc_now_string()?;
        let tray = Tray {
            id: Uuid::new_v4().to_string(),
            name: new_tray.name,
            state: TrayState::Active,
            epic_scope: None,
            transversal_epic_scope: None,
            created_at: now.clone(),
            updated_at: now,
            archived_at: None,
        };

        self.connection.execute(
            "
            INSERT INTO trays (
                id, name, state, epic_scope, transversal_epic_scope, created_at, updated_at, archived_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ",
            params![
                tray.id,
                tray.name,
                tray.state.as_db_value(),
                tray.epic_scope,
                tray.transversal_epic_scope,
                tray.created_at,
                tray.updated_at,
                tray.archived_at
            ],
        )?;

        Ok(tray)
    }

    pub fn list(&self) -> DbResult<Vec<Tray>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, name, state, epic_scope, transversal_epic_scope, created_at, updated_at, archived_at
            FROM trays
            ORDER BY updated_at DESC, created_at DESC
            ",
        )?;

        let trays = statement
            .query_map([], map_tray_row)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(trays)
    }

    pub fn find_by_id(&self, id: &str) -> DbResult<Option<Tray>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, name, state, epic_scope, transversal_epic_scope, created_at, updated_at, archived_at
            FROM trays
            WHERE id = ?1
            ",
        )?;

        let result = statement.query_row([id], map_tray_row);

        match result {
            Ok(tray) => Ok(Some(tray)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    pub fn update_name(&self, id: &str, name: &str) -> DbResult<Option<Tray>> {
        let updated_at = utc_now_string()?;
        let changed = self.connection.execute(
            "UPDATE trays SET name = ?1, updated_at = ?2 WHERE id = ?3",
            (name, updated_at, id),
        )?;

        if changed == 0 {
            return Ok(None);
        }

        self.find_by_id(id)
    }

    pub fn update_epic_scopes(
        &self,
        id: &str,
        epic_scope: Option<&str>,
        transversal_epic_scope: Option<&str>,
    ) -> DbResult<Option<Tray>> {
        let normalized_epic_scope = normalize_optional_epic_scope(epic_scope)?;
        let normalized_transversal_scope = match normalized_epic_scope.as_deref() {
            Some("TBD") => None,
            _ => normalize_optional_epic_scope(transversal_epic_scope)?,
        };
        let updated_at = utc_now_string()?;
        let changed = self.connection.execute(
            "
            UPDATE trays
            SET epic_scope = ?1, transversal_epic_scope = ?2, updated_at = ?3
            WHERE id = ?4
            ",
            (
                normalized_epic_scope.as_deref(),
                normalized_transversal_scope.as_deref(),
                updated_at.as_str(),
                id,
            ),
        )?;

        if changed == 0 {
            return Ok(None);
        }

        self.find_by_id(id)
    }

    pub fn archive(&self, id: &str) -> DbResult<Option<Tray>> {
        let now = utc_now_string()?;
        let changed = self.connection.execute(
            "UPDATE trays SET state = ?1, archived_at = ?2, updated_at = ?2 WHERE id = ?3",
            (TrayState::Archived.as_db_value(), &now, id),
        )?;

        if changed == 0 {
            return Ok(None);
        }

        self.find_by_id(id)
    }

    pub fn restore(&self, id: &str) -> DbResult<Option<Tray>> {
        let now = utc_now_string()?;
        let changed = self.connection.execute(
            "UPDATE trays SET state = ?1, archived_at = NULL, updated_at = ?2 WHERE id = ?3",
            (TrayState::Active.as_db_value(), now, id),
        )?;

        if changed == 0 {
            return Ok(None);
        }

        self.find_by_id(id)
    }

    pub fn delete(&self, id: &str) -> DbResult<bool> {
        let changed = self
            .connection
            .execute("DELETE FROM trays WHERE id = ?1", [id])?;
        Ok(changed > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory_database;

    #[test]
    fn seeds_and_updates_categories() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = CategoryRepository::new(&connection);

        let projects = repository
            .list(Some("project"))
            .expect("project categories list");
        assert!(projects.iter().any(|category| category.name == "STT"));
        assert!(projects
            .iter()
            .any(|category| category.name == "Legacy Sandbox" && category.hidden));

        let created = repository
            .create("project", "  Gameplay   UX  ")
            .expect("project category creates");
        assert_eq!(created.name, "Gameplay UX");
        assert_eq!(created.category_type, "project");
        assert_eq!(created.source, "local");
        assert!(!created.hidden);

        let updated = repository
            .update(&created.id, Some("UX Polish"), Some(true))
            .expect("project category updates")
            .expect("project category exists");
        assert_eq!(updated.name, "UX Polish");
        assert!(updated.hidden);

        assert!(repository
            .delete(&updated.id)
            .expect("project category deletes"));
        assert!(!repository
            .delete(&updated.id)
            .expect("missing delete is false"));
    }

    #[test]
    fn syncs_catalog_templates_for_ai_description_context() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = CategoryRepository::new(&connection);

        repository
            .sync_area_catalog_contract(
                &[SyncedCatalogArea {
                    area_display_name: "Programación".to_string(),
                    jira_label: "Programación".to_string(),
                    enabled_in_jtf: true,
                    issue_type: "Story".to_string(),
                    default_delivery_format: "Feature de Programación".to_string(),
                    safe_aliases: vec!["Programacion".to_string()],
                    notes: "Usar para trabajo de código.".to_string(),
                }],
                &[SyncedDeliveryFormat {
                    format_name: "Feature de Programación".to_string(),
                    issue_type: "Story".to_string(),
                    story_headings: vec!["Historia de usuario".to_string(), "Alcance".to_string()],
                    minimum_deliverable: "PR/MR listo con implementación, pruebas y evidencia."
                        .to_string(),
                    review_checklist: vec![
                        "PR/MR creado.".to_string(),
                        "Validación en runtime documentada.".to_string(),
                    ],
                }],
                &[SyncedAreaFormatRule {
                    area_display_name: "Programación".to_string(),
                    order: 1,
                    condition: "fallback".to_string(),
                    delivery_format: "Feature de Programación".to_string(),
                    blocking: false,
                }],
            )
            .expect("catalog sync persists");

        let context = repository
            .catalog_template_context_for_area("Programación", "Implementar cooldown")
            .expect("catalog context loads")
            .expect("catalog context exists");

        assert!(context.contains("Synced Notion catalog template:"));
        assert!(context.contains("- Delivery format: Feature de Programación"));
        assert!(context.contains(
            "- Minimum deliverable: PR/MR listo con implementación, pruebas y evidencia."
        ));
        assert!(context.contains("- PR/MR creado."));
        assert!(context.contains("- Validación en runtime documentada."));
    }

    #[test]
    fn catalog_template_context_uses_confirmed_delivery_format_only_when_mapped() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = CategoryRepository::new(&connection);

        repository
            .sync_area_catalog_contract(
                &[SyncedCatalogArea {
                    area_display_name: "Arquitectura".to_string(),
                    jira_label: "Arquitectura".to_string(),
                    enabled_in_jtf: true,
                    issue_type: "Story".to_string(),
                    default_delivery_format: "Arquitectura - Brief".to_string(),
                    safe_aliases: vec![],
                    notes: "".to_string(),
                }],
                &[
                    SyncedDeliveryFormat {
                        format_name: "Arquitectura - Brief".to_string(),
                        issue_type: "Story".to_string(),
                        story_headings: vec!["Contexto".to_string()],
                        minimum_deliverable: "Brief validado desde catálogo.".to_string(),
                        review_checklist: vec!["Brief revisado.".to_string()],
                    },
                    SyncedDeliveryFormat {
                        format_name: "Arquitectura - Propuesta Final".to_string(),
                        issue_type: "Story".to_string(),
                        story_headings: vec!["Alcance".to_string()],
                        minimum_deliverable: "Propuesta final validada desde catálogo.".to_string(),
                        review_checklist: vec!["Decisión final revisada.".to_string()],
                    },
                ],
                &[
                    SyncedAreaFormatRule {
                        area_display_name: "Arquitectura".to_string(),
                        order: 1,
                        condition: "fallback".to_string(),
                        delivery_format: "Arquitectura - Brief".to_string(),
                        blocking: false,
                    },
                    SyncedAreaFormatRule {
                        area_display_name: "Arquitectura".to_string(),
                        order: 2,
                        condition: "fallback".to_string(),
                        delivery_format: "Arquitectura - Propuesta Final".to_string(),
                        blocking: false,
                    },
                ],
            )
            .expect("catalog sync persists");

        let context = repository
            .catalog_template_context_for_confirmed_delivery_format(
                "Arquitectura",
                "Arquitectura - Propuesta Final",
            )
            .expect("catalog context loads")
            .expect("catalog context exists");

        assert!(context.contains("- Delivery format: Arquitectura - Propuesta Final"));
        assert!(context.contains("- Minimum deliverable: Propuesta final validada desde catálogo."));
        assert!(!context.contains("Brief validado desde catálogo."));

        let error = repository
            .catalog_template_context_for_confirmed_delivery_format(
                "Arquitectura",
                "Formato inventado",
            )
            .expect_err("unmapped format is rejected");
        assert!(error.to_string().contains(
            "Delivery format must be one of the catalog formats mapped to Arquitectura."
        ));
    }

    #[test]
    fn manages_manual_areas_like_local_categories() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = CategoryRepository::new(&connection);

        let created = repository
            .create("area", "  __manual_area_edit_fixture__   alpha  ")
            .expect("manual area creates");
        assert_eq!(created.name, "__manual_area_edit_fixture__ alpha");
        assert_eq!(created.category_type, "area");
        assert_eq!(created.source, "local");

        let renamed = repository
            .update(
                &created.id,
                Some("__manual_area_edit_fixture__ beta"),
                Some(true),
            )
            .expect("manual area updates")
            .expect("manual area exists");
        assert_eq!(renamed.name, "__manual_area_edit_fixture__ beta");
        assert_eq!(renamed.source, "local");
        assert!(renamed.hidden);

        assert!(repository.delete(&renamed.id).expect("manual area deletes"));
        assert!(!repository
            .list(Some("area"))
            .expect("area categories list")
            .iter()
            .any(|category| category.id == renamed.id));
    }

    #[test]
    fn project_sync_promotes_local_projects_and_remembers_ignored_candidates() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = CategoryRepository::new(&connection);

        repository
            .create("project", "Moon Lab")
            .expect("local project creates");

        let synced = repository
            .apply_project_sync_decisions(ProjectSyncApplyRequest {
                active_project_names: vec!["Moon Lab".to_string()],
                ignored_project_names: vec!["PilotLab".to_string()],
                archived_project_names: vec!["Legacy Sandbox".to_string()],
                candidates: vec![
                    ProjectSyncCandidate {
                        name: "Moon Lab".to_string(),
                        normalized_name: "moon-lab".to_string(),
                        jira_issue_keys: vec!["JTFTEST-10".to_string()],
                        status: "new".to_string(),
                        already_local: true,
                        will_promote_local: true,
                    },
                    ProjectSyncCandidate {
                        name: "PilotLab".to_string(),
                        normalized_name: "pilotlab".to_string(),
                        jira_issue_keys: vec!["JTFTEST-11".to_string()],
                        status: "new".to_string(),
                        already_local: false,
                        will_promote_local: false,
                    },
                    ProjectSyncCandidate {
                        name: "Legacy Sandbox".to_string(),
                        normalized_name: "legacy-sandbox".to_string(),
                        jira_issue_keys: vec!["JTFTEST-12".to_string()],
                        status: "new".to_string(),
                        already_local: true,
                        will_promote_local: false,
                    },
                ],
            })
            .expect("project sync decisions apply");

        assert!(synced.iter().any(|category| {
            category.name == "Transversal" && category.source == "jira" && !category.hidden
        }));
        assert!(synced.iter().any(|category| {
            category.name == "Moon Lab" && category.source == "jira" && !category.hidden
        }));
        assert!(!synced.iter().any(|category| category.name == "PilotLab"));
        assert!(synced.iter().any(|category| {
            category.name == "Legacy Sandbox" && category.source == "jira" && category.hidden
        }));

        let decisions = repository
            .list_project_sync_decisions()
            .expect("project sync decisions list");
        assert!(decisions
            .iter()
            .any(|decision| decision.name == "PilotLab" && decision.status == "ignored"));
    }

    #[test]
    fn catalog_sync_deletes_manual_and_stale_areas_not_in_synced_catalog() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = CategoryRepository::new(&connection);
        let manual_area_name = "__manual_area_should_be_pruned__";

        repository
            .create("area", manual_area_name)
            .expect("manual area creates");
        assert!(repository
            .list(Some("area"))
            .expect("area categories list")
            .iter()
            .any(|category| category.name == manual_area_name));

        let synced = repository
            .sync_area_catalog_entries(&[SyncedCatalogArea {
                area_display_name: "Programación".to_string(),
                jira_label: "Programación".to_string(),
                enabled_in_jtf: true,
                issue_type: "Story".to_string(),
                default_delivery_format: "Feature de Programación".to_string(),
                safe_aliases: vec!["Programacion".to_string()],
                notes: "Usar para trabajo de código.".to_string(),
            }])
            .expect("catalog sync succeeds");

        assert_eq!(synced.len(), 1);
        assert_eq!(synced[0].name, "Programación");

        let areas = repository.list(Some("area")).expect("area categories list");
        assert!(areas
            .iter()
            .any(|category| category.name == "Programación" && category.source == "catalog"));
        assert!(!areas
            .iter()
            .any(|category| category.name == manual_area_name));
        assert!(!areas.iter().any(|category| category.name == "Bug"));
    }

    #[test]
    fn creates_updates_and_deletes_jql_favorites() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = JqlFavoriteRepository::new(&connection);

        let defaults = repository.list().expect("favorites list");
        assert!(defaults
            .iter()
            .any(|favorite| favorite.name == "Urgent open bugs"));

        let favorite = repository
            .create(
                "  JTFTEST smoke  ",
                " project = JTFTEST ORDER BY created DESC ",
            )
            .expect("favorite creates");
        assert_eq!(favorite.name, "JTFTEST smoke");
        assert_eq!(favorite.jql, "project = JTFTEST ORDER BY created DESC");

        let updated = repository
            .update(&favorite.id, Some("JTFTEST recent"), None)
            .expect("favorite updates")
            .expect("favorite exists");
        assert_eq!(updated.name, "JTFTEST recent");
        assert_eq!(updated.jql, "project = JTFTEST ORDER BY created DESC");

        assert!(repository.delete(&favorite.id).expect("favorite deletes"));
        assert!(!repository
            .delete(&favorite.id)
            .expect("missing favorite delete is false"));
        assert!(!repository
            .list()
            .expect("favorites list after delete")
            .iter()
            .any(|favorite| favorite.id == updated.id));
    }

    #[test]
    fn creates_and_lists_trays_with_uuid_and_utc_timestamps() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = TrayRepository::new(&connection);

        let tray = repository
            .create(NewTray {
                name: "Persistence slice".to_string(),
            })
            .expect("tray creates");

        Uuid::parse_str(&tray.id).expect("id is uuid");
        assert_eq!(tray.name, "Persistence slice");
        assert_eq!(tray.state, TrayState::Active);
        assert!(tray.created_at.ends_with('Z'));
        assert!(tray.updated_at.ends_with('Z'));

        let trays = repository.list().expect("trays list");
        assert_eq!(trays, vec![tray]);
    }

    #[test]
    fn returns_none_for_missing_tray() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = TrayRepository::new(&connection);

        let tray = repository.find_by_id("missing").expect("query succeeds");

        assert_eq!(tray, None);
    }

    #[test]
    fn creates_lists_and_deletes_tasks_in_tray_order() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Persisted tray".to_string(),
            })
            .expect("tray creates");

        let first = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Resolver problema timer".to_string(),
                priority: "Highest".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("first task creates");
        let second = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Maquinas expendedoras".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("second task creates");

        assert_eq!(first.task_order, 0);
        assert_eq!(second.task_order, 1);
        assert_eq!(
            task_repository.list_for_tray(&tray.id).expect("tasks list"),
            vec![first.clone(), second.clone()]
        );

        assert!(task_repository.delete(&first.id).expect("task deletes"));
        assert_eq!(
            task_repository.list_for_tray(&tray.id).expect("tasks list"),
            vec![second]
        );
    }

    #[test]
    fn updates_and_persists_task_issue_relationships() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Relationship tray".to_string(),
            })
            .expect("tray creates");
        let blocker = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Resolver problema timer".to_string(),
                priority: "Highest".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("blocker creates");
        let blocked = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Programacion".to_string(),
                title: "Persistir avance local".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("blocked task creates");

        let updated = task_repository
            .update_issue_relationships(
                &blocked.id,
                &[LocalIssueRelationship {
                    id: "rel-blocked-blocked_by-blocker".to_string(),
                    relationship_type: "blocked_by".to_string(),
                    target_task_id: blocker.id.clone(),
                }],
            )
            .expect("relationship updates")
            .expect("task exists");

        assert_eq!(
            updated.issue_relationships,
            vec![LocalIssueRelationship {
                id: "rel-blocked-blocked_by-blocker".to_string(),
                relationship_type: "blocked_by".to_string(),
                target_task_id: blocker.id.clone(),
            }]
        );
        assert_eq!(
            task_repository
                .find_by_id(&blocked.id)
                .expect("task loads")
                .expect("task exists")
                .issue_relationships
                .len(),
            1
        );

        let cleared = task_repository
            .update_issue_relationships(&blocked.id, &[])
            .expect("relationship clears")
            .expect("task exists");
        assert!(cleared.issue_relationships.is_empty());
    }

    #[test]
    fn creates_lists_updates_and_deletes_task_attachments() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Attachment tray".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Review repro media".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");

        let created = task_repository
            .create_attachment(NewTaskAttachment {
                task_id: task.id.clone(),
                display_filename: "timer repro.mp4".to_string(),
                mime_type: Some("video/mp4".to_string()),
                purpose: "AI + Jira attachment".to_string(),
                original_size_bytes: 1024,
                original_relative_path: "attachments/task/timer-repro.mp4".to_string(),
            })
            .expect("attachment creates");

        assert_eq!(created.display_filename, "timer repro.mp4");
        assert_eq!(created.purpose, "AI + Jira attachment");
        assert_eq!(created.size_label, "1.0 KB");
        let hydrated = task_repository
            .find_by_id(&task.id)
            .expect("task loads")
            .expect("task exists");
        assert_eq!(hydrated.attachments, vec![created.clone()]);

        let updated = task_repository
            .update_attachment_purpose(&task.id, &created.id, "Jira attachment")
            .expect("attachment updates")
            .expect("task exists");
        assert_eq!(updated.attachments[0].purpose, "Jira attachment");

        let after_delete = task_repository
            .delete_attachment(&task.id, &created.id)
            .expect("attachment deletes")
            .expect("task exists");
        assert!(after_delete.attachments.is_empty());
    }

    #[test]
    fn refuses_to_mutate_attachments_for_created_tasks() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Created attachment tray".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Locked repro media".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created' WHERE id = ?1",
                [task.id.as_str()],
            )
            .expect("task status updates");

        let create_result = task_repository.create_attachment(NewTaskAttachment {
            task_id: task.id.clone(),
            display_filename: "locked.png".to_string(),
            mime_type: Some("image/png".to_string()),
            purpose: "AI + Jira attachment".to_string(),
            original_size_bytes: 512,
            original_relative_path: "attachments/task/locked.png".to_string(),
        });
        assert!(matches!(create_result, Err(DbError::InvalidData(_))));

        assert_eq!(
            task_repository
                .update_attachment_purpose(&task.id, "missing", "AI only")
                .expect("created task update is ignored"),
            None
        );
        assert_eq!(
            task_repository
                .delete_attachment(&task.id, "missing")
                .expect("created task delete is ignored"),
            None
        );
    }

    #[test]
    fn creates_subtask_under_parent_task() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Sub-task tray".to_string(),
            })
            .expect("tray creates");
        let parent = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Model vending machine".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("parent task creates");

        let subtask = task_repository
            .create_subtask(NewSubtask {
                parent_task_id: parent.id.clone(),
                title: "Reference pass".to_string(),
            })
            .expect("sub-task creates");

        assert_eq!(subtask.tray_id, tray.id);
        assert_eq!(subtask.project, parent.project);
        assert_eq!(subtask.area, parent.area);
        assert_eq!(subtask.priority, parent.priority);
        assert_eq!(subtask.issue_type, "Sub-task");
        assert_eq!(subtask.description_status, "Ready");
        assert_eq!(subtask.parent_task_id.as_deref(), Some(parent.id.as_str()));
        assert_eq!(subtask.task_order, 1);
    }

    #[test]
    fn deletes_parent_task_graph_without_orphaning_subtasks() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Delete graph tray".to_string(),
            })
            .expect("tray creates");
        let parent = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Model vending machine".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("parent task creates");
        let sibling = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Keep sibling".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("sibling task creates");
        task_repository
            .create_subtask(NewSubtask {
                parent_task_id: parent.id.clone(),
                title: "Reference pass".to_string(),
            })
            .expect("sub-task creates");

        assert!(task_repository
            .delete(&parent.id)
            .expect("parent task graph deletes"));

        assert_eq!(
            task_repository.list_for_tray(&tray.id).expect("tasks list"),
            vec![sibling]
        );
    }

    #[test]
    fn refuses_to_orphan_created_subtasks_when_deleting_parent() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Created child tray".to_string(),
            })
            .expect("tray creates");
        let parent = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Model vending machine".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("parent task creates");
        let subtask = task_repository
            .create_subtask(NewSubtask {
                parent_task_id: parent.id.clone(),
                title: "Reference pass".to_string(),
            })
            .expect("sub-task creates");
        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created' WHERE id = ?1",
                [subtask.id.as_str()],
            )
            .expect("subtask status updates");

        assert!(!task_repository
            .delete(&parent.id)
            .expect("parent delete is blocked"));
        assert_eq!(
            task_repository
                .list_for_tray(&tray.id)
                .expect("tasks list")
                .len(),
            2
        );
    }

    #[test]
    fn rejects_subtask_without_parent_task() {
        let connection = open_in_memory_database().expect("database opens");
        let task_repository = TaskRepository::new(&connection);

        let result = task_repository.create_subtask(NewSubtask {
            parent_task_id: "missing-parent".to_string(),
            title: "Reference pass".to_string(),
        });

        assert!(matches!(result, Err(DbError::InvalidData(_))));
    }

    #[test]
    fn marks_pending_and_failed_tasks_as_csv_exported() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "CSV tray".to_string(),
            })
            .expect("tray creates");

        let pending = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Pending export".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("pending task creates");
        let failed = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Polish".to_string(),
                title: "Failed export".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("failed task creates");
        let created = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Created task".to_string(),
                priority: "Low".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("created task creates");

        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Failed' WHERE id = ?1",
                [failed.id.as_str()],
            )
            .expect("failed status updates");
        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created' WHERE id = ?1",
                [created.id.as_str()],
            )
            .expect("created status updates");

        let marked = task_repository
            .mark_csv_exported(&[pending.id.clone(), failed.id.clone(), created.id.clone()])
            .expect("tasks mark exported");

        assert_eq!(marked.len(), 3);
        let statuses = task_repository
            .list_for_tray(&tray.id)
            .expect("tasks list")
            .into_iter()
            .map(|task| (task.id, task.sync_status))
            .collect::<Vec<_>>();

        assert!(statuses.contains(&(pending.id, "Exported".to_string())));
        assert!(statuses.contains(&(failed.id, "Exported".to_string())));
        assert!(statuses.contains(&(created.id, "Created".to_string())));
    }

    #[test]
    fn keeps_created_jira_links_stable_across_retry_status_updates() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Duplicate guard".to_string(),
            })
            .expect("tray creates");
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Already created in Jira".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");

        task_repository
            .mark_jira_created(
                &task.id,
                "JTFTEST-101",
                "https://example.atlassian.net/browse/JTFTEST-101",
                "JTFTEST-EPIC",
            )
            .expect("task marks created")
            .expect("task exists");
        let duplicate_create = task_repository
            .mark_jira_created(
                &task.id,
                "JTFTEST-999",
                "https://example.atlassian.net/browse/JTFTEST-999",
                "JTFTEST-OTHER",
            )
            .expect("duplicate mark is ignored")
            .expect("task still exists");
        let failed_retry = task_repository
            .mark_jira_failed(&task.id)
            .expect("failed retry is ignored")
            .expect("task still exists");
        task_repository
            .mark_csv_exported(std::slice::from_ref(&task.id))
            .expect("csv export retry is ignored");
        let final_task = task_repository
            .find_by_id(&task.id)
            .expect("task reloads")
            .expect("task exists");

        for task in [duplicate_create, failed_retry, final_task] {
            assert_eq!(task.sync_status, "Created");
            assert_eq!(task.jira_key.as_deref(), Some("JTFTEST-101"));
            assert_eq!(
                task.jira_url.as_deref(),
                Some("https://example.atlassian.net/browse/JTFTEST-101")
            );
            assert_eq!(task.epic_key.as_deref(), Some("JTFTEST-EPIC"));
        }

        let subtask = task_repository
            .create_subtask(NewSubtask {
                parent_task_id: task.id.clone(),
                title: "Created child step".to_string(),
            })
            .expect("subtask creates");
        task_repository
            .mark_jira_subtask_created(
                &subtask.id,
                "JTFTEST-102",
                "https://example.atlassian.net/browse/JTFTEST-102",
            )
            .expect("subtask marks created")
            .expect("subtask exists");

        let duplicate_subtask_create = task_repository
            .mark_jira_subtask_created(
                &subtask.id,
                "JTFTEST-998",
                "https://example.atlassian.net/browse/JTFTEST-998",
            )
            .expect("duplicate subtask mark is ignored")
            .expect("subtask still exists");

        assert_eq!(duplicate_subtask_create.sync_status, "Created");
        assert_eq!(
            duplicate_subtask_create.jira_key.as_deref(),
            Some("JTFTEST-102")
        );
        assert_eq!(
            duplicate_subtask_create.jira_url.as_deref(),
            Some("https://example.atlassian.net/browse/JTFTEST-102")
        );
        assert_eq!(duplicate_subtask_create.epic_key, None);
    }

    #[test]
    fn updates_editable_task_details_but_not_created_tasks() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Details tray".to_string(),
            })
            .expect("tray creates");

        let editable = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Editable task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("editable task creates");
        let created = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Created task".to_string(),
                priority: "Low".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("created task creates");

        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created' WHERE id = ?1",
                [created.id.as_str()],
            )
            .expect("created status updates");

        let updated = task_repository
            .update_details(
                &editable.id,
                "PilotLab",
                "Polish",
                "Polished task",
                "High",
                "Story",
            )
            .expect("task updates")
            .expect("task remains editable");

        assert_eq!(updated.project, "PilotLab");
        assert_eq!(updated.area, "Polish");
        assert_eq!(updated.title, "Polished task");
        assert_eq!(updated.priority, "High");
        assert_eq!(updated.issue_type, "Story");

        let blocked = task_repository
            .update_details(
                &created.id,
                "PilotLab",
                "Bug",
                "Should not update",
                "Highest",
                "Bug",
            )
            .expect("created task update is ignored");

        assert_eq!(blocked, None);
    }

    #[test]
    fn deletes_only_tasks_that_are_not_created() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Delete guard".to_string(),
            })
            .expect("tray creates");

        let pending = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Pending task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("pending task creates");
        let created = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Created task".to_string(),
                priority: "Low".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("created task creates");

        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created' WHERE id = ?1",
                [created.id.as_str()],
            )
            .expect("created status updates");

        assert!(!task_repository
            .delete(&created.id)
            .expect("created task delete is ignored"));
        assert!(task_repository
            .delete(&pending.id)
            .expect("pending task deletes"));

        let remaining_tasks = task_repository.list_for_tray(&tray.id).expect("tasks list");
        assert_eq!(remaining_tasks.len(), 1);
        assert_eq!(remaining_tasks[0].id, created.id);
        assert_eq!(remaining_tasks[0].sync_status, "Created");
    }

    #[test]
    fn moves_retryable_tasks_to_another_tray_without_copying_created_tasks() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let source_tray = tray_repository
            .create(NewTray {
                name: "Source".to_string(),
            })
            .expect("source tray creates");
        let recovery_tray = tray_repository
            .create(NewTray {
                name: "Recovery".to_string(),
            })
            .expect("recovery tray creates");
        let failed = task_repository
            .create(NewTask {
                tray_id: source_tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Failed task".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("failed task creates");
        let created = task_repository
            .create(NewTask {
                tray_id: source_tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Created task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("created task creates");

        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Failed' WHERE id = ?1",
                [failed.id.as_str()],
            )
            .expect("failed status updates");
        connection
            .execute(
                "UPDATE tasks SET sync_status = 'Created' WHERE id = ?1",
                [created.id.as_str()],
            )
            .expect("created status updates");

        let moved = task_repository
            .move_tasks_to_tray(&[failed.id.clone(), created.id.clone()], &recovery_tray.id)
            .expect("tasks move");

        assert_eq!(moved.len(), 1);
        let source_tasks = task_repository
            .list_for_tray(&source_tray.id)
            .expect("source tasks list");
        let recovery_tasks = task_repository
            .list_for_tray(&recovery_tray.id)
            .expect("recovery tasks list");

        assert!(source_tasks.iter().any(|task| task.id == created.id));
        assert!(recovery_tasks.iter().any(|task| task.id == failed.id));
        assert!(!recovery_tasks.iter().any(|task| task.id == created.id));
    }

    #[test]
    fn derives_tray_state_from_task_sync_status_after_task_changes() {
        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let task_repository = TaskRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "State tray".to_string(),
            })
            .expect("tray creates");
        let first = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "First task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("first task creates");
        let second = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Second task".to_string(),
                priority: "High".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("second task creates");

        task_repository
            .mark_jira_created(
                &first.id,
                "JTFTEST-10",
                "https://example.test/browse/JTFTEST-10",
                "JTFTEST-9",
            )
            .expect("first task marks created");
        assert_eq!(
            tray_repository
                .find_by_id(&tray.id)
                .expect("tray query")
                .expect("tray exists")
                .state,
            TrayState::Active
        );

        task_repository
            .mark_jira_created(
                &second.id,
                "JTFTEST-11",
                "https://example.test/browse/JTFTEST-11",
                "JTFTEST-9",
            )
            .expect("second task marks created");
        assert_eq!(
            tray_repository
                .find_by_id(&tray.id)
                .expect("tray query")
                .expect("tray exists")
                .state,
            TrayState::Completed
        );

        let third = task_repository
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Polish".to_string(),
                title: "New work reopens tray".to_string(),
                priority: "Low".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("third task creates");
        assert_eq!(
            tray_repository
                .find_by_id(&tray.id)
                .expect("tray query")
                .expect("tray exists")
                .state,
            TrayState::Active
        );

        task_repository
            .mark_jira_failed(&third.id)
            .expect("third task marks failed");
        assert_eq!(
            tray_repository
                .find_by_id(&tray.id)
                .expect("tray query")
                .expect("tray exists")
                .state,
            TrayState::NeedsAttention
        );
    }

    #[test]
    fn stores_proposals_with_fixed_sections_and_applies_accepted_description() {
        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Description proposal tray".to_string(),
            })
            .expect("tray creates");
        let task = TaskRepository::new(&connection)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Resolver problema timer".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let repository = AssistedDescriptionProposalRepository::new(&connection);

        let proposal = repository
            .create(NewAssistedDescriptionProposal {
                task_id: task.id.clone(),
                title: Some("Timer description pass".to_string()),
                summary: Some("Draft DTS Jira description".to_string()),
                provider: Some("OpenAI".to_string()),
                model: Some("gpt-4.1".to_string()),
                user_comment: Some("Focus on context and scope.".to_string()),
                sections: vec![
                    proposal_section(
                        "user_story",
                        "Como QA, quiero que el timer cierre al completar objetivos.",
                    ),
                    proposal_section(
                        "problem",
                        "El timer puede seguir activo despues de completar el flujo.",
                    ),
                ],
            })
            .expect("proposal creates");

        assert_eq!(proposal.status, AssistedDescriptionProposalStatus::Pending);
        assert_eq!(
            proposal.sections.len(),
            ASSISTED_DESCRIPTION_SECTION_DEFINITIONS.len()
        );
        assert_eq!(proposal.provider.as_deref(), Some("OpenAI"));
        assert!(proposal
            .sections
            .iter()
            .any(|section| section.section_id == "scope"
                && section.proposed_content.is_empty()
                && section.status == DescriptionSectionStatus::Raw));

        let revised = repository
            .update_section(
                &proposal.id,
                "problem",
                Some("El timer puede seguir activo despues de completar el flujo y confundir el cierre de QA."),
                Some(DescriptionSectionStatus::Raw),
                Some("Make the context concrete."),
                false,
            )
            .expect("proposal section updates")
            .expect("proposal exists");
        let revised_problem = revised
            .sections
            .iter()
            .find(|section| section.section_id == "problem")
            .expect("problem section exists");
        assert_eq!(
            revised_problem.reviewer_comment.as_deref(),
            Some("Make the context concrete.")
        );

        let accepted = repository
            .transition(
                &proposal.id,
                AssistedDescriptionProposalStatus::Accepted,
                Some("Accepted after review."),
                true,
            )
            .expect("proposal accepts")
            .expect("proposal exists");
        assert_eq!(accepted.status, AssistedDescriptionProposalStatus::Accepted);
        assert_eq!(polished_section_count(&accepted.sections), 2);

        let task = TaskRepository::new(&connection)
            .find_by_id(&task.id)
            .expect("task reloads")
            .expect("task exists");
        let description = task.description.expect("description applied");
        assert!(description.contains("## Historia de usuario"));
        assert!(description.contains("## Contexto"));
        assert!(!description.contains("SRS Lite"));
        assert!(!description.contains("SRE Lite"));
        assert!(!description.contains("OpenAI"));

        let log = repository
            .list_log_for_task(&task.id)
            .expect("proposal log lists");
        assert_eq!(
            log.iter()
                .map(|entry| entry.event_type.as_str())
                .collect::<Vec<_>>(),
            vec![
                "description.proposal.created",
                "description.proposal.section_updated",
                "description.proposal.status_changed"
            ]
        );
        assert_eq!(log[2].status, AssistedDescriptionProposalStatus::Accepted);
        assert_eq!(log[2].provider.as_deref(), Some("OpenAI"));
        assert_eq!(log[2].model.as_deref(), Some("gpt-4.1"));
    }

    #[test]
    fn accepts_reviewer_requested_empty_proposal_sections() {
        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Empty proposal section tray".to_string(),
            })
            .expect("tray creates");
        let task = TaskRepository::new(&connection)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Keep section empty".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let repository = AssistedDescriptionProposalRepository::new(&connection);
        let proposal = repository
            .create(NewAssistedDescriptionProposal {
                task_id: task.id.clone(),
                title: Some("Empty section proposal".to_string()),
                summary: None,
                provider: None,
                model: None,
                user_comment: Some("Keep problem empty.".to_string()),
                sections: vec![proposal_section("problem", "")],
            })
            .expect("proposal creates");

        let updated = repository
            .update_section(
                &proposal.id,
                "problem",
                Some(""),
                Some(DescriptionSectionStatus::Polished),
                Some("Leave this section empty."),
                true,
            )
            .expect("section updates")
            .expect("proposal exists");
        let problem = updated
            .sections
            .iter()
            .find(|section| section.section_id == "problem")
            .expect("problem section exists");

        assert_eq!(problem.status, DescriptionSectionStatus::Polished);
        assert_eq!(
            problem.reviewer_comment.as_deref(),
            Some("Leave this section empty.")
        );
    }

    #[test]
    fn proposal_metadata_cascades_when_task_is_deleted() {
        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Proposal cascade tray".to_string(),
            })
            .expect("tray creates");
        let task_repository = TaskRepository::new(&connection);
        let task = task_repository
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Delete with proposal".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let proposal_repository = AssistedDescriptionProposalRepository::new(&connection);
        proposal_repository
            .create(NewAssistedDescriptionProposal {
                task_id: task.id.clone(),
                title: None,
                summary: None,
                provider: Some("Claude".to_string()),
                model: Some("claude-sonnet-4-20250514".to_string()),
                user_comment: None,
                sections: vec![proposal_section(
                    "user_story",
                    "Como usuario, quiero una descripcion revisable.",
                )],
            })
            .expect("proposal creates");

        assert!(task_repository.delete(&task.id).expect("task deletes"));

        assert!(proposal_repository
            .list_for_task(&task.id)
            .expect("proposals list")
            .is_empty());
        assert!(proposal_repository
            .list_log_for_task(&task.id)
            .expect("log lists")
            .is_empty());
    }

    #[test]
    fn reads_and_updates_app_settings() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = SettingsRepository::new(&connection);

        let defaults = repository
            .get_app_settings()
            .expect("default settings load");

        assert_eq!(defaults.theme_mode, "dark");
        assert_eq!(defaults.jira_site_url, "https://dts.atlassian.net");
        assert_eq!(defaults.jira_creation_project_key, "");

        let updated = repository
            .update_app_settings(AppSettings {
                theme_mode: "system".to_string(),
                jira_site_url: "https://example.atlassian.net".to_string(),
                jira_account_email: "saimon@example.com".to_string(),
                jira_auth_method: "api-token".to_string(),
                jira_creation_project_key: "JTFTEST".to_string(),
                ai_provider: "OpenAI".to_string(),
                ai_model: "gpt-4.1-mini".to_string(),
                default_content_language: "Spanish".to_string(),
                ..AppSettings::default()
            })
            .expect("settings update");

        assert_eq!(updated.theme_mode, "system");
        assert_eq!(
            repository.get_app_settings().expect("settings reload"),
            updated
        );
    }

    #[test]
    fn canonicalizes_jira_site_url_when_saving_settings() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = SettingsRepository::new(&connection);

        let updated = repository
            .update_app_settings(AppSettings {
                theme_mode: "system".to_string(),
                jira_site_url: "https://EXAMPLE.atlassian.net/".to_string(),
                jira_account_email: "saimon@example.com".to_string(),
                jira_auth_method: "api-token".to_string(),
                jira_creation_project_key: "JTFTEST".to_string(),
                ai_provider: "OpenAI".to_string(),
                ai_model: "gpt-4.1-mini".to_string(),
                default_content_language: "Spanish".to_string(),
                ..AppSettings::default()
            })
            .expect("settings update");

        assert_eq!(updated.jira_site_url, "https://example.atlassian.net");
        assert_eq!(
            repository
                .get_app_settings()
                .expect("settings reload")
                .jira_site_url,
            "https://example.atlassian.net"
        );
    }

    #[test]
    fn rejects_invalid_jira_site_url_when_saving_settings() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = SettingsRepository::new(&connection);

        let error = repository
            .update_app_settings(AppSettings {
                theme_mode: "system".to_string(),
                jira_site_url: "https://evil.example.com".to_string(),
                jira_account_email: "saimon@example.com".to_string(),
                jira_auth_method: "api-token".to_string(),
                jira_creation_project_key: "JTFTEST".to_string(),
                ai_provider: "OpenAI".to_string(),
                ai_model: "gpt-4.1-mini".to_string(),
                default_content_language: "Spanish".to_string(),
                ..AppSettings::default()
            })
            .expect_err("custom hosts should fail");

        assert!(error
            .to_string()
            .contains("Jira site URL must use an Atlassian Cloud host."));
    }

    #[test]
    fn updates_unrelated_settings_when_existing_jira_site_url_is_legacy() {
        let connection = open_in_memory_database().expect("database opens");
        connection
            .execute(
                "
                INSERT INTO settings (key, value_json, updated_at)
                VALUES ('app_settings', ?1, '2026-06-15T00:00:00Z')
                ",
                [serde_json::json!({
                    "themeMode": "dark",
                    "jiraSiteUrl": "https://legacy.example.com/path",
                    "jiraAccountEmail": "saimon@example.com",
                    "jiraAuthMethod": "api-token",
                    "jiraCreationProjectKey": "JTFTEST",
                    "aiProvider": "OpenAI",
                    "aiModel": "gpt-4.1",
                    "defaultContentLanguage": "Spanish"
                })
                .to_string()],
            )
            .expect("legacy settings inserted");
        let repository = SettingsRepository::new(&connection);

        let updated = repository
            .update_app_settings(AppSettings {
                theme_mode: "light".to_string(),
                jira_site_url: "https://legacy.example.com/path".to_string(),
                jira_account_email: "saimon@example.com".to_string(),
                jira_auth_method: "api-token".to_string(),
                jira_creation_project_key: "JTFTEST".to_string(),
                ai_provider: "OpenAI".to_string(),
                ai_model: "gpt-4.1".to_string(),
                default_content_language: "Spanish".to_string(),
                ..AppSettings::default()
            })
            .expect("unrelated setting updates");

        assert_eq!(updated.theme_mode, "light");
        assert_eq!(updated.jira_site_url, "https://legacy.example.com/path");
    }

    #[test]
    fn records_sync_attempts_and_audit_events() {
        use crate::sync_audit::metadata_preflight_detail;

        let connection = open_in_memory_database().expect("database opens");
        let tray_repository = TrayRepository::new(&connection);
        let tray = tray_repository
            .create(NewTray {
                name: "Audit tray".to_string(),
            })
            .expect("tray creates");
        let task = TaskRepository::new(&connection)
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Audit task".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let repository = SyncRepository::new(&connection);

        let attempt_id = repository
            .start_attempt(&tray.id, "create-in-jira")
            .expect("attempt starts");
        repository
            .record_event(
                &attempt_id,
                &tray.id,
                Some(&task.id),
                "jira.sync.started",
                "succeeded",
                "create-parent-issues",
                metadata_preflight_detail("JTFTEST", vec!["Story".to_string()], 2),
            )
            .expect("event records");
        repository
            .finish_attempt(&attempt_id, "succeeded")
            .expect("attempt finishes");

        let attempt_status: String = connection
            .query_row(
                "SELECT status FROM sync_attempts WHERE id = ?1",
                [attempt_id.as_str()],
                |row| row.get(0),
            )
            .expect("attempt status reads");
        let (provider, operation, detail_json): (String, String, String) = connection
            .query_row(
                "
                SELECT provider, operation, detail_json
                FROM sync_audit_events
                WHERE sync_attempt_id = ?1
                ",
                [attempt_id.as_str()],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("audit event reads");
        let detail: serde_json::Value =
            serde_json::from_str(&detail_json).expect("detail json parses");

        assert_eq!(attempt_status, "succeeded");
        assert_eq!(provider, "jira");
        assert_eq!(operation, "create-parent-issues");
        assert_eq!(detail["jiraProjectKey"], "JTFTEST");
        assert_eq!(detail["taskCount"], 2);

        let task_events = repository
            .list_for_task(&task.id)
            .expect("task audit events list");
        assert_eq!(task_events.len(), 1);
        assert_eq!(task_events[0].event_type, "jira.sync.started");
        assert_eq!(task_events[0].outcome, "succeeded");
        assert_eq!(task_events[0].detail["jiraProjectKey"], "JTFTEST");
    }

    #[test]
    fn redacts_and_caps_sync_audit_detail_before_persistence() {
        use crate::sync_audit::audit_error_detail;

        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Audit redaction".to_string(),
            })
            .expect("tray creates");
        let task = TaskRepository::new(&connection)
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Audit redaction task".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let repository = SyncRepository::new(&connection);
        let attempt_id = repository
            .start_attempt(&tray.id, "create-in-jira")
            .expect("attempt starts");

        repository
            .record_event(
                &attempt_id,
                &tray.id,
                Some(&task.id),
                "jira.issue.create",
                "failed",
                "create-parent-issues",
                audit_error_detail(&format!(
                    "Authorization: Basic secret-token request body: {}",
                    "x".repeat(900)
                )),
            )
            .expect("event records");

        let detail_json: String = connection
            .query_row(
                "
                SELECT detail_json
                FROM sync_audit_events
                WHERE sync_attempt_id = ?1
                ",
                [attempt_id.as_str()],
                |row| row.get(0),
            )
            .expect("detail reads");
        let detail: serde_json::Value =
            serde_json::from_str(&detail_json).expect("detail json parses");
        let message = detail["message"].as_str().expect("message persists");

        assert!(message.contains("Basic <redacted>"));
        assert!(!message.contains("secret-token"));
        assert!(message.chars().count() <= 500);
    }

    #[test]
    fn updates_tray_name_and_timestamp() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = TrayRepository::new(&connection);
        let tray = repository
            .create(NewTray {
                name: "Old name".to_string(),
            })
            .expect("tray creates");

        let updated = repository
            .update_name(&tray.id, "Launch prep")
            .expect("update succeeds")
            .expect("tray exists");

        assert_eq!(updated.name, "Launch prep");
        assert_eq!(updated.id, tray.id);
        assert_ne!(updated.updated_at, "");
    }

    #[test]
    fn archives_restores_and_deletes_trays() {
        let connection = open_in_memory_database().expect("database opens");
        let repository = TrayRepository::new(&connection);
        let tray = repository
            .create(NewTray {
                name: "Lifecycle tray".to_string(),
            })
            .expect("tray creates");

        let archived = repository
            .archive(&tray.id)
            .expect("archive succeeds")
            .expect("tray exists");
        assert_eq!(archived.state, TrayState::Archived);
        assert!(archived.archived_at.is_some());

        let restored = repository
            .restore(&tray.id)
            .expect("restore succeeds")
            .expect("tray exists");
        assert_eq!(restored.state, TrayState::Active);
        assert_eq!(restored.archived_at, None);

        assert!(repository.delete(&tray.id).expect("delete succeeds"));
        assert_eq!(
            repository.find_by_id(&tray.id).expect("query succeeds"),
            None
        );
    }

    fn proposal_section(
        section_id: &str,
        proposed_content: &str,
    ) -> AssistedDescriptionProposalSection {
        AssistedDescriptionProposalSection {
            section_id: section_id.to_string(),
            heading: String::new(),
            current_content: String::new(),
            proposed_content: proposed_content.to_string(),
            status: DescriptionSectionStatus::Raw,
            reviewer_comment: None,
            updated_at: None,
        }
    }
}
