use super::AppServices;
use crate::db::DbResult;
use crate::models::AppSettings;
use crate::repositories::SettingsRepository;

impl AppServices {
    pub fn get_app_settings(&self) -> DbResult<AppSettings> {
        let connection = self.connection();
        SettingsRepository::new(&connection).get_app_settings()
    }

    pub fn update_app_settings(&self, settings: AppSettings) -> DbResult<AppSettings> {
        let connection = self.connection();
        SettingsRepository::new(&connection).update_app_settings(settings)
    }
}
