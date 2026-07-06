use super::AppServices;
use crate::db::DbResult;
use crate::models::{NewTray, Tray};
use crate::repositories::{TaskRepository, TrayRepository};

impl AppServices {
    pub fn create_tray(&self, new_tray: NewTray) -> DbResult<Tray> {
        let connection = self.connection();
        TrayRepository::new(&connection).create(new_tray)
    }

    pub fn list_trays(&self) -> DbResult<Vec<Tray>> {
        let connection = self.connection();
        TrayRepository::new(&connection).list()
    }

    pub fn rename_tray(&self, tray_id: &str, name: &str) -> DbResult<Option<Tray>> {
        let connection = self.connection();
        TrayRepository::new(&connection).update_name(tray_id, name)
    }

    pub fn update_tray_epic_scopes(
        &self,
        tray_id: &str,
        epic_scope: Option<&str>,
        transversal_epic_scope: Option<&str>,
    ) -> DbResult<Option<Tray>> {
        let connection = self.connection();
        TrayRepository::new(&connection).update_epic_scopes(
            tray_id,
            epic_scope,
            transversal_epic_scope,
        )
    }

    pub fn archive_tray(&self, tray_id: &str) -> DbResult<Option<Tray>> {
        let connection = self.connection();
        TrayRepository::new(&connection).archive(tray_id)
    }

    pub fn restore_tray(&self, tray_id: &str) -> DbResult<Option<Tray>> {
        let connection = self.connection();
        TrayRepository::new(&connection).restore(tray_id)
    }

    pub fn delete_tray(&self, tray_id: &str) -> DbResult<bool> {
        let attachment_paths = {
            let connection = self.connection();
            TaskRepository::new(&connection).attachment_paths_for_tray_delete(tray_id)?
        };
        self.remove_managed_attachment_files(&attachment_paths)?;

        let connection = self.connection();
        TrayRepository::new(&connection).delete(tray_id)
    }
}
