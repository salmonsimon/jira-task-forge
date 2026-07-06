use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use uuid::Uuid;

use crate::db::{DbError, DbResult};

pub const JIRA_CLOUD_FALLBACK_ATTACHMENT_UPLOAD_LIMIT_BYTES: u64 = 1_000_000_000;
pub const PERSONAL_V1_JIRA_ATTACHMENT_MAX_BYTES: u64 = 100 * 1024 * 1024;

const ATTACHMENTS_DIR: &str = "attachments";
const STAGING_DIR: &str = "staging";
const IMPORTS_STAGING_DIR: &str = "imports";
const ACTIVE_STAGING_MARKER: &str = ".jtf-staging-active";
const FAILURE_EVIDENCE_FILE: &str = "import-error.txt";
const STAGED_IMPORT_FILE: &str = "backup.json";
const DEFAULT_STALE_STAGING_AGE: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentFileGrant {
    source_path: PathBuf,
}

impl AttachmentFileGrant {
    pub fn from_backend_file_dialog(source_path: PathBuf) -> Self {
        Self { source_path }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManagedAttachmentFile {
    pub absolute_path: PathBuf,
    pub relative_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttachmentImportStaging {
    operation_dir: PathBuf,
    staged_file: PathBuf,
}

impl AttachmentImportStaging {
    pub fn staged_file(&self) -> &Path {
        self.staged_file.as_path()
    }
}

pub fn managed_attachment_relative_path(task_id: &str, filename: &str) -> String {
    [
        ATTACHMENTS_DIR.to_string(),
        sanitize_path_segment(task_id),
        format!("{}-{}", Uuid::new_v4(), sanitize_path_segment(filename)),
    ]
    .join("/")
}

pub fn stage_backup_import_file(
    app_data_dir: &Path,
    source_path: &Path,
) -> DbResult<AttachmentImportStaging> {
    let source_metadata = fs::symlink_metadata(source_path)?;
    if source_metadata.file_type().is_symlink() {
        return Err(DbError::InvalidData(
            "Backup import source must not be a symbolic link.".to_string(),
        ));
    }
    if !source_metadata.is_file() {
        return Err(DbError::InvalidData(
            "Backup import source must be a file.".to_string(),
        ));
    }

    let staging_root = attachment_staging_root(app_data_dir);
    ensure_staging_root_is_safe(&staging_root)?;

    let operation_dir = staging_root
        .join(IMPORTS_STAGING_DIR)
        .join(Uuid::new_v4().to_string());
    fs::create_dir_all(&operation_dir)?;
    ensure_path_stays_under_staging_root(&staging_root, &operation_dir)?;

    fs::write(operation_dir.join(ACTIVE_STAGING_MARKER), b"active\n")?;
    let staged_file = operation_dir.join(STAGED_IMPORT_FILE);
    fs::copy(source_path, &staged_file)?;

    Ok(AttachmentImportStaging {
        operation_dir,
        staged_file,
    })
}

pub fn complete_backup_import_staging(staging: &AttachmentImportStaging) -> DbResult<()> {
    remove_staging_operation_dir(&staging.operation_dir)
}

pub fn fail_backup_import_staging(
    staging: &AttachmentImportStaging,
    error_message: &str,
) -> DbResult<()> {
    if staging.staged_file.exists() {
        remove_file_without_following_symlink(&staging.staged_file)?;
    }
    let evidence = sanitize_staging_failure_evidence(error_message);
    fs::write(staging.operation_dir.join(FAILURE_EVIDENCE_FILE), evidence)?;
    let marker = staging.operation_dir.join(ACTIVE_STAGING_MARKER);
    if marker.exists() {
        remove_file_without_following_symlink(&marker)?;
    }
    Ok(())
}

pub fn cleanup_stale_attachment_staging_files(app_data_dir: &Path) -> DbResult<()> {
    cleanup_stale_attachment_staging_files_older_than(app_data_dir, DEFAULT_STALE_STAGING_AGE)
}

pub fn cleanup_stale_attachment_staging_files_older_than(
    app_data_dir: &Path,
    stale_after: Duration,
) -> DbResult<()> {
    let staging_root = attachment_staging_root(app_data_dir);
    match fs::symlink_metadata(&staging_root) {
        Ok(_) => ensure_staging_root_is_safe(&staging_root)?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    }

    for entry in fs::read_dir(&staging_root)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        if file_type.is_symlink() {
            remove_file_without_following_symlink(&path)?;
            continue;
        }
        if file_type.is_dir() {
            cleanup_stale_staging_children(&staging_root, &path, stale_after)?;
            remove_dir_if_empty(&path)?;
        } else if is_stale(&entry.metadata()?, stale_after)? {
            remove_file_without_following_symlink(&path)?;
        }
    }

    remove_dir_if_empty(&staging_root)?;
    Ok(())
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

pub fn copy_granted_source_into_managed_attachment(
    app_data_dir: &Path,
    grant: &AttachmentFileGrant,
    task_id: &str,
    purpose: &str,
) -> DbResult<(String, String, u64)> {
    let source_path = grant.source_path.as_path();
    let metadata = validate_attachment_source(app_data_dir, source_path, purpose)?;

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

fn validate_attachment_source(
    app_data_dir: &Path,
    source_path: &Path,
    purpose: &str,
) -> DbResult<fs::Metadata> {
    let source_metadata = fs::symlink_metadata(source_path)?;
    if source_metadata.file_type().is_symlink() {
        return Err(DbError::InvalidData(
            "Attachment source must not be a symbolic link.".to_string(),
        ));
    }
    if !source_metadata.is_file() {
        return Err(DbError::InvalidData(
            "Only files can be attached.".to_string(),
        ));
    }
    if source_metadata.len() == 0 {
        return Err(DbError::InvalidData(
            "Attachment file cannot be empty.".to_string(),
        ));
    }
    if is_jira_ready_attachment_purpose(purpose)
        && source_metadata.len() > PERSONAL_V1_JIRA_ATTACHMENT_MAX_BYTES
    {
        return Err(DbError::InvalidData(format!(
            "Jira-ready attachments must be 100 MB or smaller."
        )));
    }

    let canonical_app_data_dir = app_data_dir.canonicalize()?;
    let canonical_source = source_path.canonicalize()?;
    if canonical_source.starts_with(&canonical_app_data_dir) {
        return Err(DbError::InvalidData(
            "Attachment source must not be inside Jira Task Forge app data.".to_string(),
        ));
    }

    Ok(source_metadata)
}

fn is_jira_ready_attachment_purpose(purpose: &str) -> bool {
    matches!(purpose.trim(), "Jira attachment" | "AI + Jira attachment")
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

fn attachment_staging_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(ATTACHMENTS_DIR).join(STAGING_DIR)
}

fn ensure_staging_root_is_safe(staging_root: &Path) -> DbResult<()> {
    match fs::symlink_metadata(staging_root) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err(DbError::InvalidData(
                    "attachment staging root must not be a symbolic link".to_string(),
                ));
            }
            if !metadata.is_dir() {
                return Err(DbError::InvalidData(
                    "attachment staging root must be a directory".to_string(),
                ));
            }
            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(staging_root)?;
            Ok(())
        }
        Err(error) => Err(error.into()),
    }
}

fn ensure_path_stays_under_staging_root(staging_root: &Path, path: &Path) -> DbResult<()> {
    let canonical_root = staging_root.canonicalize()?;
    let canonical_path = path.canonicalize()?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(DbError::InvalidData(
            "attachment staging path escapes managed storage".to_string(),
        ));
    }
    Ok(())
}

fn cleanup_stale_staging_children(
    staging_root: &Path,
    parent: &Path,
    stale_after: Duration,
) -> DbResult<()> {
    for entry in fs::read_dir(parent)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        if file_type.is_symlink() {
            remove_file_without_following_symlink(&path)?;
            continue;
        }
        if file_type.is_dir() {
            ensure_path_stays_under_staging_root(staging_root, &path)?;
            let marker = path.join(ACTIVE_STAGING_MARKER);
            if marker.exists() && is_stale(&fs::metadata(&marker)?, stale_after)? {
                remove_staging_operation_dir(&path)?;
            }
        } else if is_stale(&entry.metadata()?, stale_after)? {
            remove_file_without_following_symlink(&path)?;
        }
    }
    Ok(())
}

fn remove_staging_operation_dir(operation_dir: &Path) -> DbResult<()> {
    if !operation_dir.exists() {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(operation_dir)?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(DbError::InvalidData(
            "attachment staging operation path must be a directory".to_string(),
        ));
    }
    fs::remove_dir_all(operation_dir)?;
    Ok(())
}

fn remove_file_without_following_symlink(path: &Path) -> DbResult<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn remove_dir_if_empty(path: &Path) -> DbResult<()> {
    match fs::remove_dir(path) {
        Ok(()) => Ok(()),
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::NotFound | std::io::ErrorKind::DirectoryNotEmpty
            ) =>
        {
            Ok(())
        }
        Err(error) => Err(error.into()),
    }
}

fn is_stale(metadata: &fs::Metadata, stale_after: Duration) -> DbResult<bool> {
    let modified = metadata.modified()?;
    Ok(modified.elapsed().unwrap_or_default() >= stale_after)
}

fn sanitize_staging_failure_evidence(error_message: &str) -> String {
    let sanitized = error_message
        .chars()
        .map(|character| {
            if character.is_control() && character != '\n' {
                ' '
            } else {
                character
            }
        })
        .collect::<String>();
    let sanitized = sanitized.trim();
    let clipped = sanitized.chars().take(2_000).collect::<String>();
    format!("Import failed before staged attachment bytes could be retained.\nError: {clipped}\n")
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
    use super::{
        cleanup_stale_attachment_staging_files_older_than, complete_backup_import_staging,
        fail_backup_import_staging, managed_attachment_relative_path, stage_backup_import_file,
        validate_managed_relative_path,
    };
    use std::fs;
    use std::time::Duration;
    use uuid::Uuid;

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

    #[test]
    fn successful_import_staging_is_removed_after_completion() {
        let app_data_dir =
            std::env::temp_dir().join(format!("jtf-staging-success-{}", Uuid::new_v4()));
        let source = app_data_dir.join("source-backup.json");
        fs::create_dir_all(&app_data_dir).expect("app data dir creates");
        fs::write(&source, "{}").expect("source backup writes");

        let staging = stage_backup_import_file(&app_data_dir, &source).expect("backup stages");
        assert!(staging.staged_file().exists());
        let operation_dir = staging
            .staged_file()
            .parent()
            .expect("staged file has operation dir")
            .to_path_buf();

        complete_backup_import_staging(&staging).expect("staging completes");

        assert!(!operation_dir.exists());
        fs::remove_dir_all(&app_data_dir).expect("app data cleanup");
    }

    #[test]
    fn failed_import_staging_keeps_error_evidence_without_file_bytes() {
        let app_data_dir =
            std::env::temp_dir().join(format!("jtf-staging-failure-{}", Uuid::new_v4()));
        let source = app_data_dir.join("source-backup.json");
        fs::create_dir_all(&app_data_dir).expect("app data dir creates");
        fs::write(&source, "{\"bad\":").expect("source backup writes");

        let staging = stage_backup_import_file(&app_data_dir, &source).expect("backup stages");
        let operation_dir = staging
            .staged_file()
            .parent()
            .expect("staged file has operation dir")
            .to_path_buf();

        fail_backup_import_staging(&staging, "parse failed").expect("failure records evidence");

        assert!(!staging.staged_file().exists());
        let evidence =
            fs::read_to_string(operation_dir.join("import-error.txt")).expect("evidence reads");
        assert!(evidence.contains("parse failed"));
        fs::remove_dir_all(&app_data_dir).expect("app data cleanup");
    }

    #[test]
    fn stale_staging_cleanup_is_idempotent_and_removes_interrupted_operations() {
        let app_data_dir =
            std::env::temp_dir().join(format!("jtf-staging-stale-{}", Uuid::new_v4()));
        let source = app_data_dir.join("source-backup.json");
        fs::create_dir_all(&app_data_dir).expect("app data dir creates");
        fs::write(&source, "{}").expect("source backup writes");
        let staging = stage_backup_import_file(&app_data_dir, &source).expect("backup stages");
        let operation_dir = staging
            .staged_file()
            .parent()
            .expect("staged file has operation dir")
            .to_path_buf();

        cleanup_stale_attachment_staging_files_older_than(&app_data_dir, Duration::ZERO)
            .expect("stale cleanup succeeds");
        cleanup_stale_attachment_staging_files_older_than(&app_data_dir, Duration::ZERO)
            .expect("stale cleanup is idempotent");

        assert!(!operation_dir.exists());
        fs::remove_dir_all(&app_data_dir).expect("app data cleanup");
    }

    #[test]
    fn staging_cleanup_rejects_symlinked_staging_root_without_touching_target() {
        let app_data_dir =
            std::env::temp_dir().join(format!("jtf-staging-symlink-{}", Uuid::new_v4()));
        let outside_dir =
            std::env::temp_dir().join(format!("jtf-staging-outside-{}", Uuid::new_v4()));
        let outside_file = outside_dir.join("sentinel.txt");
        fs::create_dir_all(app_data_dir.join("attachments")).expect("attachments dir creates");
        fs::create_dir_all(&outside_dir).expect("outside dir creates");
        fs::write(&outside_file, "keep").expect("outside file writes");

        #[cfg(unix)]
        std::os::unix::fs::symlink(
            &outside_dir,
            app_data_dir.join("attachments").join("staging"),
        )
        .expect("staging symlink creates");

        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(
            &outside_dir,
            app_data_dir.join("attachments").join("staging"),
        )
        .expect("staging symlink creates");

        let error =
            cleanup_stale_attachment_staging_files_older_than(&app_data_dir, Duration::ZERO)
                .expect_err("symlinked root rejected");

        assert!(error.to_string().contains("staging root"));
        assert_eq!(
            fs::read_to_string(&outside_file).expect("outside file remains"),
            "keep"
        );
        fs::remove_dir_all(&app_data_dir).expect("app data cleanup");
        fs::remove_dir_all(&outside_dir).expect("outside cleanup");
    }
}
