use super::AppServices;
use crate::db::DbResult;
use crate::models::SyncAuditEvent;
use crate::repositories::SyncRepository;

impl AppServices {
    pub fn list_task_sync_audit_events(&self, task_id: &str) -> DbResult<Vec<SyncAuditEvent>> {
        let connection = self.connection();
        SyncRepository::new(&connection).list_for_task(task_id)
    }
}
