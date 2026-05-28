use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::db::{DbError, DbResult};

pub const JIRA_CLOUD_FALLBACK_ATTACHMENT_UPLOAD_LIMIT_BYTES: u64 = 1_000_000_000;

const ATTACHMENTS_DIR: &str = "attachments";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManagedAttachmentFile {
    pub absolute_path: PathBuf,
    pub relative_path: String,
    pub size_bytes: u64,
}

pub fn managed_attachment_relative_path(task_id: &str, filename: &str) -> String {
    [
        ATTACHMENTS_DIR.to_string(),
        sanitize_path_segment(task_id),
        format!("{}-{}", Uuid::new_v4(), sanitize_path_segment(filename)),
    ]
    .join("/")
}

pub fn validate_managed_relative_path(relative_path: &str) -> DbResult<String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err(DbError::InvalidData(
            "attachment path is required".to_string(),
        ));
    }
    if trimmed.chars().any(|character| character.is_control()) {
        return Err(DbError::InvalidData(
            "attachment path must not contain control characters".to_string(),
        ));
    }
    if trimmed.contains(':') {
        return Err(DbError::InvalidData(
            "attachment path must be relative to managed storage".to_string(),
        ));
    }

    let normalized = trimmed.replace('\\', "/");
    if normalized.starts_with('/') || normalized.starts_with("//") {
        return Err(DbError::InvalidData(
            "attachment path must be relative to managed storage".to_string(),
        ));
    }

    let parts = normalized.split('/').collect::<Vec<_>>();
    if parts.first().copied() != Some(ATTACHMENTS_DIR) {
        return Err(DbError::InvalidData(
            "attachment path must stay under managed attachments".to_string(),
        ));
    }
    if parts.len() < 3 {
        return Err(DbError::InvalidData(
            "attachment path must include an attachment file".to_string(),
        ));
    }
    if parts
        .iter()
        .any(|part| part.is_empty() || *part == "." || part.contains(".."))
    {
        return Err(DbError::InvalidData(
            "attachment path must not escape managed storage".to_string(),
        ));
    }

    Ok(parts.join("/"))
}

pub fn copy_into_managed_attachment(
    app_data_dir: &Path,
    source_path: &Path,
    task_id: &str,
) -> DbResult<(String, String, u64)> {
    let metadata = fs::metadata(source_path)?;
    if !metadata.is_file() {
        return Err(DbError::InvalidData(
            "Only files can be attached.".to_string(),
        ));
    }

    let filename = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            DbError::InvalidData("Attachment filename could not be read.".to_string())
        })?;
    let relative_path = managed_attachment_relative_path(task_id, filename);
    let absolute_path = app_data_dir.join(&relative_path);
    if let Some(parent) = absolute_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source_path, &absolute_path)?;

    Ok((filename.to_string(), relative_path, metadata.len()))
}

pub fn resolve_existing_managed_attachment_file(
    app_data_dir: &Path,
    relative_path: &str,
) -> DbResult<ManagedAttachmentFile> {
    let relative_path = validate_managed_relative_path(relative_path)?;
    let attachment_root = app_data_dir.join(ATTACHMENTS_DIR);
    let absolute_path = app_data_dir.join(&relative_path);
    let canonical_root = attachment_root.canonicalize()?;
    let canonical_path = absolute_path.canonicalize()?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(DbError::InvalidData(
            "attachment path escapes managed storage".to_string(),
        ));
    }

    let metadata = fs::metadata(&canonical_path)?;
    if !metadata.is_file() {
        return Err(DbError::InvalidData(
            "attachment path does not point to a file".to_string(),
        ));
    }

    Ok(ManagedAttachmentFile {
        absolute_path: canonical_path,
        relative_path,
        size_bytes: metadata.len(),
    })
}

pub fn remove_managed_attachment_file(app_data_dir: &Path, relative_path: &str) -> DbResult<()> {
    let relative_path = validate_managed_relative_path(relative_path)?;
    let absolute_path = app_data_dir.join(&relative_path);
    if !absolute_path.exists() {
        return Ok(());
    }

    let managed_file = resolve_existing_managed_attachment_file(app_data_dir, &relative_path)?;
    fs::remove_file(managed_file.absolute_path)?;
    Ok(())
}

pub fn sanitize_attachment_audit_name(filename: &str) -> String {
    let sanitized = filename
        .chars()
        .map(|character| {
            if character.is_control() || matches!(character, '/' | '\\') {
                '-'
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let sanitized = sanitized.trim();
    if sanitized.is_empty() {
        "attachment".to_string()
    } else {
        sanitized.chars().take(120).collect()
    }
}

fn sanitize_path_segment(value: &str) -> String {
    let mut sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    while sanitized.contains("..") {
        sanitized = sanitized.replace("..", ".-");
    }
    let sanitized = sanitized
        .trim_matches(|character| matches!(character, '-' | '.'))
        .to_string();

    if sanitized.is_empty() {
        "attachment".to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::{managed_attachment_relative_path, validate_managed_relative_path};

    #[test]
    fn validates_managed_attachment_relative_paths() {
        assert_eq!(
            validate_managed_relative_path("attachments/task/file.png").expect("path validates"),
            "attachments/task/file.png"
        );
        assert_eq!(
            validate_managed_relative_path("attachments\\task\\file.png").expect("path validates"),
            "attachments/task/file.png"
        );

        for unsafe_path in [
            "../secret.txt",
            "attachments/../secret.txt",
            "/tmp/secret.txt",
            "C:\\Users\\secret.txt",
            "\\\\server\\share\\secret.txt",
            "logs/task/file.txt",
            "attachments/task/\nsecret.txt",
        ] {
            assert!(
                validate_managed_relative_path(unsafe_path).is_err(),
                "{unsafe_path} should be rejected"
            );
        }
    }

    #[test]
    fn generated_managed_paths_stay_under_attachments() {
        let relative_path = managed_attachment_relative_path("../task", "../../secret.txt");

        assert!(relative_path.starts_with("attachments/"));
        assert!(!relative_path.contains(".."));
        validate_managed_relative_path(&relative_path).expect("generated path validates");
    }
}
