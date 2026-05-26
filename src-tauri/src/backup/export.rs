use rusqlite::Connection;

use crate::db::DbResult;

use super::format::{build_manifest, BackupFile};
use super::snapshot::export_snapshot;

pub fn export_backup(
    connection: &Connection,
    source_app_version: Option<String>,
) -> DbResult<BackupFile> {
    let data = export_snapshot(connection)?;
    let manifest = build_manifest(&data, source_app_version)?;

    Ok(BackupFile { manifest, data })
}
