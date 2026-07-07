use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use time::OffsetDateTime;

const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0001_initial_schema",
        include_str!("migrations/0001_initial_schema.sql"),
    ),
    (
        "0002_task_descriptions",
        include_str!("migrations/0002_task_descriptions.sql"),
    ),
    (
        "0003_assisted_description_proposals",
        include_str!("migrations/0003_assisted_description_proposals.sql"),
    ),
    (
        "0004_task_issue_relationships",
        include_str!("migrations/0004_task_issue_relationships.sql"),
    ),
    (
        "0005_catalog_category_source",
        include_str!("migrations/0005_catalog_category_source.sql"),
    ),
    (
        "0006_catalog_delivery_templates",
        include_str!("migrations/0006_catalog_delivery_templates.sql"),
    ),
    (
        "0007_epic_scope",
        include_str!("migrations/0007_epic_scope.sql"),
    ),
    (
        "0008_project_sync_decisions",
        include_str!("migrations/0008_project_sync_decisions.sql"),
    ),
];

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

    for (version, migration_sql) in MIGRATIONS {
        let already_applied: bool = transaction.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
            [version],
            |row| row.get(0),
        )?;

        if !already_applied {
            transaction.execute_batch(migration_sql)?;
            let applied_at = utc_now_string()?;
            transaction.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                (*version, applied_at),
            )?;
        }
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
            "assisted_description_proposals",
            "attachment_variants",
            "attachments",
            "categories",
            "description_proposal_log_entries",
            "epic_mappings",
            "jql_favorites",
            "project_sync_decisions",
            "schema_migrations",
            "settings",
            "sync_attempts",
            "sync_audit_events",
            "tasks",
            "task_issue_relationships",
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

    #[test]
    fn open_app_database_creates_parent_directory_and_runs_migrations_once() {
        let app_data_dir =
            std::env::temp_dir().join(format!("jira-task-forge-db-{}", uuid::Uuid::new_v4()));
        let path = database_path(&app_data_dir);

        {
            let connection = open_app_database(&app_data_dir).expect("database opens");
            let migration_count: i64 = connection
                .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                    row.get(0)
                })
                .expect("migration count reads");
            assert_eq!(migration_count, MIGRATIONS.len() as i64);
        }

        assert!(path.exists());

        {
            let connection = open_app_database(&app_data_dir).expect("database reopens");
            let migration_count: i64 = connection
                .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                    row.get(0)
                })
                .expect("migration count reads");
            assert_eq!(migration_count, MIGRATIONS.len() as i64);
        }

        fs::remove_dir_all(app_data_dir).expect("database cleanup");
    }
}
