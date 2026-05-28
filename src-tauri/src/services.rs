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
}

impl AppServices {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Arc::new(Mutex::new(connection)),
        }
    }

    pub(in crate::services) fn connection(&self) -> MutexGuard<'_, Connection> {
        self.connection.lock().expect("database lock poisoned")
    }
}
