use super::AppServices;
use crate::db::DbResult;
use crate::models::{JqlFavorite, JqlSearchResponse};
use crate::repositories::JqlFavoriteRepository;

impl AppServices {
    pub fn list_jql_favorites(&self) -> DbResult<Vec<JqlFavorite>> {
        let connection = self.connection();
        JqlFavoriteRepository::new(&connection).list()
    }

    pub fn create_jql_favorite(&self, name: &str, jql: &str) -> DbResult<JqlFavorite> {
        let connection = self.connection();
        JqlFavoriteRepository::new(&connection).create(name, jql)
    }

    pub fn update_jql_favorite(
        &self,
        id: &str,
        name: Option<&str>,
        jql: Option<&str>,
    ) -> DbResult<Option<JqlFavorite>> {
        let connection = self.connection();
        JqlFavoriteRepository::new(&connection).update(id, name, jql)
    }

    pub fn delete_jql_favorite(&self, id: &str) -> DbResult<bool> {
        let connection = self.connection();
        JqlFavoriteRepository::new(&connection).delete(id)
    }

    pub fn run_jql_query(
        &self,
        jql: &str,
        max_results: usize,
    ) -> Result<JqlSearchResponse, String> {
        self.jira_client()?.search_jql(jql, max_results)
    }
}
