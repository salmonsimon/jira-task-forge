use super::AppServices;
use crate::area_catalog::{
    catalog_delivery_format_gate_for_area, sync_exportable_catalog_from_notion_page,
    sync_exportable_catalog_from_url, test_notion_catalog_page, CatalogSyncResult,
    DeliveryFormatGateResult, NotionCatalogConnectionTestResult,
};
use crate::db::{DbError, DbResult};
use crate::models::Category;
use crate::project_sync::{
    build_project_sync_review, jira_epic_project_discovery_jql, ProjectSyncApplyRequest,
    ProjectSyncDiscoveryRequest, ProjectSyncReview, ProjectSyncScope,
};
use crate::repositories::{CategoryRepository, SettingsRepository};

impl AppServices {
    pub fn list_categories(&self, category_type: Option<&str>) -> DbResult<Vec<Category>> {
        let scope = self.current_project_sync_scope().ok();
        let connection = self.connection();
        CategoryRepository::new(&connection)
            .list_for_project_sync_scope(category_type, scope.as_ref())
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

    pub fn discover_project_sync_candidates(
        &self,
        request: Option<ProjectSyncDiscoveryRequest>,
    ) -> Result<ProjectSyncReview, String> {
        let (scope, client) = match request {
            Some(request) => {
                let scope = self.project_sync_scope_from_parts(
                    &request.jira_site_url,
                    &request.jira_account_email,
                    &request.jira_creation_project_key,
                )?;
                let token = self.jira_api_token()?;
                let client = self.jira_client_from_raw_parts(
                    &scope.jira_site_url,
                    &scope.jira_account_email,
                    &token,
                )?;
                (scope, client)
            }
            None => (
                self.current_project_sync_scope()
                    .map_err(|error| error.to_string())?,
                self.jira_client()?,
            ),
        };
        let jira_project_key = scope.jira_project_key.clone();
        let jql = jira_epic_project_discovery_jql(&jira_project_key)?;
        let epics = client.list_epics_for_project(&jira_project_key)?;
        let connection = self.connection();
        let repository = CategoryRepository::new(&connection);
        let projects = repository
            .list_for_project_sync_scope(Some("project"), Some(&scope))
            .map_err(|error| error.to_string())?;
        let decisions = repository
            .list_project_sync_decisions(&scope)
            .map_err(|error| error.to_string())?;

        Ok(build_project_sync_review(
            &jira_project_key,
            &jql,
            &projects,
            &epics,
            &decisions,
        ))
    }

    pub fn apply_project_sync_decisions(
        &self,
        request: ProjectSyncApplyRequest,
    ) -> DbResult<Vec<Category>> {
        let scope = self.current_project_sync_scope()?;
        let connection = self.connection();
        CategoryRepository::new(&connection).apply_project_sync_decisions(&scope, request)
    }

    pub(in crate::services) fn current_project_sync_scope(&self) -> DbResult<ProjectSyncScope> {
        let settings = self.get_app_settings()?;
        self.project_sync_scope_from_parts(
            &settings.jira_site_url,
            &settings.jira_account_email,
            &settings.jira_creation_project_key,
        )
        .map_err(DbError::InvalidData)
    }

    fn project_sync_scope_from_parts(
        &self,
        jira_site_url: &str,
        jira_account_email: &str,
        jira_project_key: &str,
    ) -> Result<ProjectSyncScope, String> {
        let jira_site_url = crate::integrations::jira::normalize_jira_site_url(jira_site_url)
            .map_err(|error| {
                format!("Jira site URL is required before syncing Projects: {error}")
            })?;
        let jira_account_email = jira_account_email.trim().to_ascii_lowercase();
        if jira_account_email.is_empty() {
            return Err("Jira account email is required before syncing Projects.".to_string());
        }
        let jira_project_key = jira_project_key.trim().to_ascii_uppercase();
        if jira_project_key.is_empty() {
            return Err(
                "Jira creation project key is required before syncing Projects.".to_string(),
            );
        }
        Ok(ProjectSyncScope {
            jira_site_url,
            jira_account_email,
            jira_project_key,
        })
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

    pub fn resolve_delivery_format_gate(
        &self,
        area: &str,
        description_or_deliverable: &str,
    ) -> Result<DeliveryFormatGateResult, String> {
        let options = {
            let connection = self.connection();
            CategoryRepository::new(&connection)
                .catalog_delivery_format_options_for_area(area)
                .map_err(|error| error.to_string())?
        };
        if options.is_empty() {
            return Ok(catalog_delivery_format_gate_for_area(
                area,
                description_or_deliverable,
            ));
        }
        if options.len() == 1 {
            return Ok(DeliveryFormatGateResult {
                kind: "auto".to_string(),
                area_display_name: area.trim().to_string(),
                format: options.first().cloned(),
                suggested_format: None,
                options,
                message: None,
            });
        }

        Ok(DeliveryFormatGateResult {
            kind: "needs_confirmation".to_string(),
            area_display_name: area.trim().to_string(),
            format: None,
            suggested_format: None,
            options,
            message: None,
        })
    }
}
