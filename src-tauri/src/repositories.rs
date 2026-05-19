use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::db::{utc_now_string, DbError, DbResult};
use crate::models::{NewTray, Tray, TrayState};

pub struct TrayRepository<'connection> {
    connection: &'connection Connection,
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
}
