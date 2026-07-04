use super::AppServices;
use crate::area_catalog::{
    sync_exportable_catalog_from_notion_page, sync_exportable_catalog_from_url,
    test_notion_catalog_page, CatalogSyncResult, NotionCatalogConnectionTestResult,
};
use crate::db::DbResult;
use crate::models::Category;
use crate::repositories::{CategoryRepository, SettingsRepository};

impl AppServices {
    pub fn list_categories(&self, category_type: Option<&str>) -> DbResult<Vec<Category>> {
        let connection = self.connection();
        CategoryRepository::new(&connection).list(category_type)
    }

    pub fn create_category(&self, category_type: &str, name: &str) -> DbResult<Category> {
        let connection = self.connection();
        CategoryRepository::new(&connection).create(category_type, name)
    }

    pub fn update_category(
        &self,
        id: &str,
        name: Option<&str>,
        hidden: Option<bool>,
    ) -> DbResult<Option<Category>> {
        let connection = self.connection();
        CategoryRepository::new(&connection).update(id, name, hidden)
    }

    pub fn delete_category(&self, id: &str) -> DbResult<bool> {
        let connection = self.connection();
        CategoryRepository::new(&connection).delete(id)
    }

    pub fn sync_area_catalog(&self) -> DbResult<Vec<Category>> {
        let connection = self.connection();
        CategoryRepository::new(&connection).sync_area_catalog()
    }

    pub fn sync_area_catalog_from_source(
        &self,
        source_url: &str,
    ) -> Result<CatalogSyncResult, String> {
        let result = sync_exportable_catalog_from_url(source_url)?;
        if !result.ok {
            return Ok(result);
        }

        let connection = self.connection();
        CategoryRepository::new(&connection)
            .sync_area_catalog_contract(
                &result.areas,
                &result.delivery_formats,
                &result.area_format_rules,
            )
            .map_err(|error| error.to_string())?;
        let mut settings = SettingsRepository::new(&connection)
            .get_app_settings()
            .map_err(|error| error.to_string())?;
        settings.catalog_source_mode = "public-exportable".to_string();
        settings.catalog_source_url = result.source_url.clone();
        SettingsRepository::new(&connection)
            .update_app_settings(settings)
            .map_err(|error| error.to_string())?;

        Ok(result)
    }

    pub fn test_notion_catalog_connection(
        &self,
        page_url_or_id: &str,
    ) -> Result<NotionCatalogConnectionTestResult, String> {
        let token = self.notion_integration_token()?;
        test_notion_catalog_page(&token, page_url_or_id)
    }

    pub fn sync_area_catalog_from_notion(
        &self,
        page_url_or_id: &str,
    ) -> Result<CatalogSyncResult, String> {
        let token = self.notion_integration_token()?;
        let result = sync_exportable_catalog_from_notion_page(&token, page_url_or_id)?;
        if !result.ok {
            return Ok(result);
        }

        let connection = self.connection();
        CategoryRepository::new(&connection)
            .sync_area_catalog_contract(
                &result.areas,
                &result.delivery_formats,
                &result.area_format_rules,
            )
            .map_err(|error| error.to_string())?;
        let mut settings = SettingsRepository::new(&connection)
            .get_app_settings()
            .map_err(|error| error.to_string())?;
        settings.catalog_source_mode = "notion".to_string();
        settings.catalog_source_url = page_url_or_id.trim().to_string();
        SettingsRepository::new(&connection)
            .update_app_settings(settings)
            .map_err(|error| error.to_string())?;

        Ok(result)
    }
}
