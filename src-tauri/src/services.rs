use std::sync::Mutex;

use rusqlite::Connection;

use crate::db::DbResult;
use crate::models::{NewTray, Tray};
use crate::repositories::TrayRepository;

pub struct AppServices {
    connection: Mutex<Connection>,
}

impl AppServices {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Mutex::new(connection),
        }
    }

    pub fn create_tray(&self, new_tray: NewTray) -> DbResult<Tray> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).create(new_tray)
    }

    pub fn list_trays(&self) -> DbResult<Vec<Tray>> {
        let connection = self.connection.lock().expect("database lock poisoned");
        TrayRepository::new(&connection).list()
    }
}
