use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::db::{utc_now_string, DbError, DbResult};
use crate::models::{LocalTask, NewTask, NewTray, Tray, TrayState};

pub struct TrayRepository<'connection> {
    connection: &'connection Connection,
}

pub struct TaskRepository<'connection> {
    connection: &'connection Connection,
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
            "SELECT tray_id FROM tasks WHERE id = ?1",
            [task_id],
            |row| row.get::<_, String>(0),
        );

        let Ok(tray_id) = tray_id else {
            return Ok(false);
        };

        let changed = self
            .connection
            .execute("DELETE FROM tasks WHERE id = ?1", [task_id])?;
        if changed > 0 {
            self.touch_tray(&tray_id, &utc_now_string()?)?;
        }

        Ok(changed > 0)
    }

    fn touch_tray(&self, tray_id: &str, updated_at: &str) -> DbResult<()> {
        self.connection.execute(
            "UPDATE trays SET updated_at = ?1 WHERE id = ?2",
            (updated_at, tray_id),
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
}
