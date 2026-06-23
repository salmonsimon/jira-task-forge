use super::AppServices;
use crate::db::DbResult;
use crate::models::Category;
use crate::repositories::CategoryRepository;

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
}
