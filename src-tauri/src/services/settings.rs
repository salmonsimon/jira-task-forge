use super::AppServices;
use crate::db::DbResult;
use crate::models::AppSettings;
use crate::repositories::SettingsRepository;

impl AppServices {
    pub fn purge_credentials_after_app_data_reset(&self) -> Result<bool, String> {
        let has_settings_row = {
            let connection = self.connection();
            SettingsRepository::new(&connection)
                .app_settings_row_exists()
                .map_err(|error| error.to_string())?
        };

        if has_settings_row {
            return Ok(false);
        }

        self.delete_all_integration_credentials()?;
        Ok(true)
    }

    pub fn get_app_settings(&self) -> DbResult<AppSettings> {
        let connection = self.connection();
        SettingsRepository::new(&connection).get_app_settings()
    }

    pub fn update_app_settings(&self, settings: AppSettings) -> DbResult<AppSettings> {
        let connection = self.connection();
        SettingsRepository::new(&connection).update_app_settings(settings)
    }
}
