use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use time::OffsetDateTime;

const INITIAL_SCHEMA: &str = include_str!("migrations/0001_initial_schema.sql");

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug)]
pub enum DbError {
    Io(std::io::Error),
    Sql(rusqlite::Error),
    Time(time::error::Format),
    InvalidData(String),
}

impl std::fmt::Display for DbError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "filesystem error: {error}"),
            Self::Sql(error) => write!(formatter, "sqlite error: {error}"),
            Self::Time(error) => write!(formatter, "time format error: {error}"),
            Self::InvalidData(message) => write!(formatter, "invalid data: {message}"),
        }
    }
}

impl std::error::Error for DbError {}

impl From<std::io::Error> for DbError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sql(error)
    }
}

impl From<time::error::Format> for DbError {
    fn from(error: time::error::Format) -> Self {
        Self::Time(error)
    }
}

pub fn open_app_database(app_data_dir: &Path) -> DbResult<Connection> {
    let database_path = database_path(app_data_dir);

    if let Some(parent) = database_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut connection = Connection::open(database_path)?;
    configure_connection(&connection)?;
    run_migrations(&mut connection)?;

    Ok(connection)
}

pub fn open_in_memory_database() -> DbResult<Connection> {
    let mut connection = Connection::open_in_memory()?;
    configure_connection(&connection)?;
    run_migrations(&mut connection)?;

    Ok(connection)
}

pub fn database_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("data").join("jira-task-forge.sqlite3")
}

pub fn utc_now_string() -> DbResult<String> {
    Ok(OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339)?)
}

fn configure_connection(connection: &Connection) -> DbResult<()> {
    connection.pragma_update(None, "foreign_keys", "ON")?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(())
}

fn run_migrations(connection: &mut Connection) -> DbResult<()> {
    let transaction = connection.transaction()?;

    transaction.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        ",
    )?;

    let already_applied: bool = transaction.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = '0001_initial_schema')",
        [],
        |row| row.get(0),
    )?;

    if !already_applied {
        transaction.execute_batch(INITIAL_SCHEMA)?;
        let applied_at = utc_now_string()?;
        transaction.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            ("0001_initial_schema", applied_at),
        )?;
    }

    transaction.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_schema_creates_expected_tables() {
        let connection = open_in_memory_database().expect("database opens");
        let mut statement = connection
            .prepare(
                "
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                ORDER BY name
                ",
            )
            .expect("table query prepares");

        let table_names: Vec<String> = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("table query runs")
            .collect::<Result<_, _>>()
            .expect("table names load");

        for expected in [
            "attachment_variants",
            "attachments",
            "categories",
            "epic_mappings",
            "jql_favorites",
            "schema_migrations",
            "settings",
            "sync_attempts",
            "sync_audit_events",
            "tasks",
            "trays",
        ] {
            assert!(
                table_names.iter().any(|table_name| table_name == expected),
                "missing table {expected}; got {table_names:?}"
            );
        }
    }

    #[test]
    fn database_path_uses_data_directory() {
        let path = database_path(Path::new("/tmp/jira-task-forge"));
        assert_eq!(
            path,
            Path::new("/tmp/jira-task-forge/data/jira-task-forge.sqlite3")
        );
    }
}
