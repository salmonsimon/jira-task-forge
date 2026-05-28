use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

use rusqlite::Connection;

mod ai;
mod backup;
mod categories;
mod credentials;
mod description_proposals;
mod jira;
mod jql;
mod settings;
mod sync_audit;
mod tasks;
mod trays;

#[cfg(test)]
mod tests;

#[derive(Clone)]
pub struct AppServices {
    connection: Arc<Mutex<Connection>>,
    app_data_dir: Arc<PathBuf>,
}

impl AppServices {
    pub fn new(connection: Connection) -> Self {
        Self::new_with_app_data_dir(
            connection,
            std::env::temp_dir().join("jira-task-forge-test-app-data"),
        )
    }

    pub fn new_with_app_data_dir(connection: Connection, app_data_dir: PathBuf) -> Self {
        Self {
            connection: Arc::new(Mutex::new(connection)),
            app_data_dir: Arc::new(app_data_dir),
        }
    }

    pub(in crate::services) fn connection(&self) -> MutexGuard<'_, Connection> {
        self.connection.lock().expect("database lock poisoned")
    }

    pub(in crate::services) fn app_data_dir(&self) -> &Path {
        self.app_data_dir.as_ref().as_path()
    }
}
