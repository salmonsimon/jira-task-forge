use rusqlite::{params, Connection};
use serde_json::Value;
use uuid::Uuid;

use crate::db::{utc_now_string, DbError, DbResult};
use crate::models::{AppSettings, LocalTask, NewTask, NewTray, Tray, TrayState};

const APP_SETTINGS_KEY: &str = "app_settings";

pub struct TrayRepository<'connection> {
    connection: &'connection Connection,
}

pub struct TaskRepository<'connection> {
    connection: &'connection Connection,
}

pub struct SettingsRepository<'connection> {
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

    pub fn update_app_settings(&self, settings: AppSettings) -> DbResult<AppSettings> {
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
            content_language: new_task.content_language,
            jira_key: None,
            jira_url: None,
            epic_key: None,
            parent_task_id: None,
            task_order,
            created_at: now.clone(),
            updated_at: now,
        };

        self.connection.execute(
            "
            INSERT INTO tasks (
                id, tray_id, project, area, title, priority, issue_type, sync_status,
                description_status, content_language, jira_key, jira_url, epic_key,
                parent_task_id, task_order, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
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

    pub fn list_for_tray(&self, tray_id: &str) -> DbResult<Vec<LocalTask>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, tray_id, project, area, title, priority, issue_type, sync_status,
                   description_status, content_language, jira_key, jira_url, epic_key,
                   parent_task_id, task_order, created_at, updated_at
            FROM tasks
            WHERE tray_id = ?1
            ORDER BY task_order ASC, created_at ASC
            ",
        )?;

        let tasks = statement
            .query_map([tray_id], map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(tasks)
    }

    pub fn list_all(&self) -> DbResult<Vec<LocalTask>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, tray_id, project, area, title, priority, issue_type, sync_status,
                   description_status, content_language, jira_key, jira_url, epic_key,
                   parent_task_id, task_order, created_at, updated_at
            FROM tasks
            ORDER BY tray_id ASC, task_order ASC, created_at ASC
            ",
        )?;

        let tasks = statement
            .query_map([], map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(tasks)
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

        let changed = self.connection.execute(
            "DELETE FROM tasks WHERE id = ?1 AND sync_status != 'Created'",
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
            SET sync_status = 'Created',
                jira_key = ?1,
                jira_url = ?2,
                epic_key = ?3,
                updated_at = ?4
            WHERE id = ?5
            ",
            (jira_key, jira_url, epic_key, now.as_str(), task_id),
        )?;
        self.touch_tray(&tray_id, &now)?;

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
        detail: Value,
    ) -> DbResult<()> {
        let event_id = Uuid::new_v4().to_string();
        let occurred_at = utc_now_string()?;
        let detail_json = serde_json::to_string(&detail)
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
        content_language: row.get("content_language")?,
        jira_key: row.get("jira_key")?,
        jira_url: row.get("jira_url")?,
        epic_key: row.get("epic_key")?,
        parent_task_id: row.get("parent_task_id")?,
        task_order: row.get("task_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
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
            created_at: now.clone(),
            updated_at: now,
            archived_at: None,
        };

        self.connection.execute(
            "
            INSERT INTO trays (id, name, state, created_at, updated_at, archived_at)
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

        Ok(tray)
    }

    pub fn list(&self) -> DbResult<Vec<Tray>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, name, state, created_at, updated_at, archived_at
            FROM trays
            ORDER BY updated_at DESC, created_at DESC
            ",
        )?;

        let trays = statement
            .query_map([], |row| {
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
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                    archived_at: row.get("archived_at")?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(trays)
    }

    pub fn find_by_id(&self, id: &str) -> DbResult<Option<Tray>> {
        let mut statement = self.connection.prepare(
            "
            SELECT id, name, state, created_at, updated_at, archived_at
            FROM trays
            WHERE id = ?1
            ",
        )?;

        let result = statement.query_row([id], |row| {
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
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
                archived_at: row.get("archived_at")?,
            })
        });

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
            })
            .expect("settings update");

        assert_eq!(updated.theme_mode, "system");
        assert_eq!(
            repository.get_app_settings().expect("settings reload"),
            updated
        );
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
}
