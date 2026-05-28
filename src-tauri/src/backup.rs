mod applier;
mod attachment_files;
mod audit_policy;
mod export;
mod format;
mod import_plan;
mod snapshot;

pub use applier::import_backup;
pub use export::export_backup;
#[allow(unused_imports)]
pub use format::{
    AttachmentBackup, AttachmentVariantBackup, AuditSummaryBackup, BackupData, BackupExportResult,
    BackupFile, BackupImportResult, BackupManifest, EpicMappingBackup,
};

#[cfg(test)]
mod tests {
    use super::{
        export_backup, import_backup, AttachmentBackup, AttachmentVariantBackup,
        AuditSummaryBackup, EpicMappingBackup,
    };
    use crate::db::open_in_memory_database;
    use crate::models::{
        AssistedDescriptionProposalSection, DescriptionSectionStatus,
        NewAssistedDescriptionProposal, NewTask, NewTray,
    };
    use crate::repositories::{
        AssistedDescriptionProposalRepository, TaskRepository, TrayRepository,
    };

    #[test]
    fn exports_backup_without_secrets() {
        let connection = open_in_memory_database().expect("database opens");
        let tray = TrayRepository::new(&connection)
            .create(NewTray {
                name: "Backup tray".to_string(),
            })
            .expect("tray creates");
        TaskRepository::new(&connection)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Backup task".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");

        let backup =
            export_backup(&connection, Some("0.1.0-test".to_string())).expect("backup exports");

        assert_eq!(backup.manifest.app, "jira-task-forge");
        assert_eq!(backup.manifest.format_version, 1);
        assert!(!backup.manifest.secrets_included);
        assert_eq!(
            backup.manifest.source_app_version.as_deref(),
            Some("0.1.0-test")
        );
        assert_eq!(backup.manifest.record_counts["trays"], 1);
        assert_eq!(backup.manifest.record_counts["tasks"], 1);
        assert_eq!(backup.data.tasks[0].title, "Backup task");
    }

    #[test]
    fn imports_backup_by_merging_new_records() {
        let source = open_in_memory_database().expect("source database opens");
        let tray = TrayRepository::new(&source)
            .create(NewTray {
                name: "Imported tray".to_string(),
            })
            .expect("tray creates");
        TaskRepository::new(&source)
            .create(NewTask {
                tray_id: tray.id.clone(),
                project: "PilotLab".to_string(),
                area: "Polish".to_string(),
                title: "Imported task".to_string(),
                priority: "Medium".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let backup = export_backup(&source, None).expect("backup exports");

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["trays"], 1);
        assert_eq!(result.imported_counts["tasks"], 1);
        assert!(result.warnings.is_empty());
        assert_eq!(
            TrayRepository::new(&target).list().expect("trays list")[0].name,
            "Imported tray"
        );
        assert_eq!(
            TaskRepository::new(&target).list_all().expect("tasks list")[0].title,
            "Imported task"
        );
    }

    #[test]
    fn exports_and_imports_assisted_description_proposals_without_secrets() {
        let source = open_in_memory_database().expect("source database opens");
        let tray = TrayRepository::new(&source)
            .create(NewTray {
                name: "Proposal backup".to_string(),
            })
            .expect("tray creates");
        let task = TaskRepository::new(&source)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "Bug".to_string(),
                title: "Persist proposal metadata".to_string(),
                priority: "High".to_string(),
                issue_type: "Bug".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        AssistedDescriptionProposalRepository::new(&source)
            .create(NewAssistedDescriptionProposal {
                task_id: task.id.clone(),
                title: Some("Proposal backup card".to_string()),
                summary: Some("Only local review metadata".to_string()),
                provider: Some("OpenAI".to_string()),
                model: Some("gpt-4.1".to_string()),
                user_comment: Some("Keep this comment, not keys.".to_string()),
                sections: vec![proposal_section(
                    "user_story",
                    "Como usuario, quiero respaldo local de la propuesta.",
                )],
            })
            .expect("proposal creates");

        let backup = export_backup(&source, None).expect("backup exports");

        assert_eq!(
            backup.manifest.record_counts["assistedDescriptionProposals"],
            1
        );
        assert_eq!(backup.manifest.record_counts["descriptionProposalLog"], 1);
        assert!(!backup.manifest.secrets_included);
        assert_eq!(
            backup.data.assisted_description_proposals[0]
                .provider
                .as_deref(),
            Some("OpenAI")
        );
        let serialized = serde_json::to_string(&backup).expect("backup serializes");
        assert!(!serialized.contains("sk-test-secret"));

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["assistedDescriptionProposals"], 1);
        assert_eq!(result.imported_counts["descriptionProposalLog"], 1);
        assert_eq!(
            AssistedDescriptionProposalRepository::new(&target)
                .list_for_task(&task.id)
                .expect("proposals list")[0]
                .title,
            "Proposal backup card"
        );
        assert_eq!(
            AssistedDescriptionProposalRepository::new(&target)
                .list_log_for_task(&task.id)
                .expect("log lists")[0]
                .provider
                .as_deref(),
            Some("OpenAI")
        );
    }

    #[test]
    fn validates_backup_format_without_database_mutation() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.secrets_included = true;

        let error = super::format::validate_backup_file(&backup)
            .expect_err("secret backup manifest rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: backup unexpectedly claims to include secrets"
        );
    }

    #[test]
    fn plans_audit_summary_import_policy_without_sqlite_mutation() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.audit_summaries.push(AuditSummaryBackup {
            sync_attempt_id: Some("attempt-1".to_string()),
            tray_id: None,
            task_id: None,
            event_type: "jira.create".to_string(),
            occurred_at: "2026-05-25T12:00:00Z".to_string(),
            outcome: "success".to_string(),
            provider: Some("jira".to_string()),
            operation: Some("create_issue".to_string()),
        });

        let target = open_in_memory_database().expect("target database opens");
        let categories_before = count_rows(&target, "categories");
        let audit_events_before = count_rows(&target, "sync_audit_events");

        let plan = super::import_plan::create_import_plan(&target, backup).expect("import plans");

        assert_eq!(plan.planned_skipped_counts()["auditSummaries"], 1);
        assert_eq!(
            plan.warnings,
            vec!["Audit summaries were reviewed but are not imported into local audit tables yet."]
        );
        assert_eq!(count_rows(&target, "categories"), categories_before);
        assert_eq!(
            count_rows(&target, "sync_audit_events"),
            audit_events_before
        );
    }

    #[test]
    fn plans_reference_dependent_import_skips_before_apply() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.epic_mappings.push(EpicMappingBackup {
            id: "mapping-1".to_string(),
            project_category_id: "missing-project".to_string(),
            area_category_id: "missing-area".to_string(),
            jira_epic_key: "JTFTEST-1".to_string(),
            jira_epic_url: None,
            synced_at: None,
            created_at: "2026-05-25T12:00:00Z".to_string(),
            updated_at: "2026-05-25T12:00:00Z".to_string(),
        });
        backup.data.attachment_metadata.push(AttachmentBackup {
            id: "attachment-1".to_string(),
            task_id: "missing-task".to_string(),
            display_filename: "reference.png".to_string(),
            mime_type: Some("image/png".to_string()),
            purpose: "Jira attachment".to_string(),
            original_size_bytes: 123,
            original_relative_path: "attachments/reference.png".to_string(),
            file_hash: Some("hash".to_string()),
            restore_status: None,
            created_at: "2026-05-25T12:00:00Z".to_string(),
            updated_at: "2026-05-25T12:00:00Z".to_string(),
        });
        backup
            .data
            .attachment_variants
            .push(AttachmentVariantBackup {
                id: "variant-1".to_string(),
                attachment_id: "missing-attachment".to_string(),
                profile: "compressed".to_string(),
                mime_type: "image/webp".to_string(),
                size_bytes: 42,
                relative_path: "attachments/reference.webp".to_string(),
                accepted_at: None,
                created_at: "2026-05-25T12:00:00Z".to_string(),
            });

        let target = open_in_memory_database().expect("target database opens");
        let plan = super::import_plan::create_import_plan(&target, backup).expect("import plans");

        assert_eq!(plan.planned_skipped_counts()["epicMappings"], 1);
        assert_eq!(plan.planned_skipped_counts()["attachmentMetadata"], 1);
        assert_eq!(plan.planned_skipped_counts()["attachmentVariants"], 1);
        assert_eq!(
            plan.warnings,
            vec![
                "Skipped epic mapping JTFTEST-1 because its category references were not imported.",
                "Skipped attachment metadata reference.png because its task was not imported.",
                "Skipped attachment variant compressed because its attachment metadata was not imported.",
            ]
        );
    }

    #[test]
    fn rejects_backups_that_claim_to_include_secrets() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.secrets_included = true;

        let mut target = open_in_memory_database().expect("target database opens");
        let error = import_backup(&mut target, backup).expect_err("secret backup rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: backup unexpectedly claims to include secrets"
        );
    }

    #[test]
    fn rejects_backups_from_other_apps() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.app = "other-app".to_string();

        let mut target = open_in_memory_database().expect("target database opens");
        let error = import_backup(&mut target, backup).expect_err("wrong app rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: backup app must be jira-task-forge"
        );
    }

    #[test]
    fn rejects_unsupported_backup_versions() {
        let connection = open_in_memory_database().expect("database opens");
        let mut backup = export_backup(&connection, None).expect("backup exports");
        backup.manifest.format_version = 999;

        let mut target = open_in_memory_database().expect("target database opens");
        let error = import_backup(&mut target, backup).expect_err("unsupported version rejects");

        assert_eq!(
            error.to_string(),
            "invalid data: unsupported backup format version 999"
        );
    }

    #[test]
    fn skips_duplicate_records_on_reimport() {
        let source = open_in_memory_database().expect("source database opens");
        let tray = TrayRepository::new(&source)
            .create(NewTray {
                name: "Duplicate tray".to_string(),
            })
            .expect("tray creates");
        TaskRepository::new(&source)
            .create(NewTask {
                tray_id: tray.id,
                project: "STT".to_string(),
                area: "3D".to_string(),
                title: "Duplicate task".to_string(),
                priority: "Low".to_string(),
                issue_type: "Story".to_string(),
                content_language: "Spanish".to_string(),
            })
            .expect("task creates");
        let backup = export_backup(&source, None).expect("backup exports");

        let mut target = open_in_memory_database().expect("target database opens");
        import_backup(&mut target, backup.clone()).expect("first import succeeds");
        let result = import_backup(&mut target, backup).expect("second import succeeds");

        assert_eq!(result.imported_counts["trays"], 0);
        assert_eq!(result.skipped_counts["trays"], 1);
        assert_eq!(result.imported_counts["tasks"], 0);
        assert_eq!(result.skipped_counts["tasks"], 1);
        assert_eq!(result.imported_counts["settings"], 1);
    }

    #[test]
    fn warns_and_skips_audit_summaries_on_import() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.audit_summaries.push(AuditSummaryBackup {
            sync_attempt_id: Some("attempt-1".to_string()),
            tray_id: None,
            task_id: None,
            event_type: "jira.create".to_string(),
            occurred_at: "2026-05-25T12:00:00Z".to_string(),
            outcome: "success".to_string(),
            provider: Some("jira".to_string()),
            operation: Some("create_issue".to_string()),
        });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.skipped_counts["auditSummaries"], 1);
        assert_eq!(
            result.warnings,
            vec!["Audit summaries were reviewed but are not imported into local audit tables yet."]
        );
    }

    #[test]
    fn warns_and_skips_epic_mappings_with_missing_categories() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.epic_mappings.push(EpicMappingBackup {
            id: "mapping-1".to_string(),
            project_category_id: "missing-project".to_string(),
            area_category_id: "missing-area".to_string(),
            jira_epic_key: "JTFTEST-1".to_string(),
            jira_epic_url: None,
            synced_at: None,
            created_at: "2026-05-25T12:00:00Z".to_string(),
            updated_at: "2026-05-25T12:00:00Z".to_string(),
        });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["epicMappings"], 0);
        assert_eq!(result.skipped_counts["epicMappings"], 1);
        assert_eq!(
            result.warnings,
            vec![
                "Skipped epic mapping JTFTEST-1 because its category references were not imported."
            ]
        );
    }

    #[test]
    fn warns_and_skips_attachment_metadata_with_missing_tasks() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup.data.attachment_metadata.push(AttachmentBackup {
            id: "attachment-1".to_string(),
            task_id: "missing-task".to_string(),
            display_filename: "reference.png".to_string(),
            mime_type: Some("image/png".to_string()),
            purpose: "Jira attachment".to_string(),
            original_size_bytes: 123,
            original_relative_path: "attachments/reference.png".to_string(),
            file_hash: Some("hash".to_string()),
            restore_status: None,
            created_at: "2026-05-25T12:00:00Z".to_string(),
            updated_at: "2026-05-25T12:00:00Z".to_string(),
        });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["attachmentMetadata"], 0);
        assert_eq!(result.skipped_counts["attachmentMetadata"], 1);
        assert_eq!(
            result.warnings,
            vec!["Skipped attachment metadata reference.png because its task was not imported."]
        );
    }

    #[test]
    fn warns_and_skips_attachment_variants_with_missing_metadata() {
        let source = open_in_memory_database().expect("source database opens");
        let mut backup = export_backup(&source, None).expect("backup exports");
        backup
            .data
            .attachment_variants
            .push(AttachmentVariantBackup {
                id: "variant-1".to_string(),
                attachment_id: "missing-attachment".to_string(),
                profile: "compressed".to_string(),
                mime_type: "image/webp".to_string(),
                size_bytes: 42,
                relative_path: "attachments/reference.webp".to_string(),
                accepted_at: None,
                created_at: "2026-05-25T12:00:00Z".to_string(),
            });

        let mut target = open_in_memory_database().expect("target database opens");
        let result = import_backup(&mut target, backup).expect("backup imports");

        assert_eq!(result.imported_counts["attachmentVariants"], 0);
        assert_eq!(result.skipped_counts["attachmentVariants"], 1);
        assert_eq!(
            result.warnings,
            vec!["Skipped attachment variant compressed because its attachment metadata was not imported."]
        );
    }

    fn count_rows(connection: &rusqlite::Connection, table: &str) -> i64 {
        let sql = format!("SELECT COUNT(*) FROM {table}");
        connection
            .query_row(sql.as_str(), [], |row| row.get(0))
            .expect("row count reads")
    }

    fn proposal_section(
        section_id: &str,
        proposed_content: &str,
    ) -> AssistedDescriptionProposalSection {
        AssistedDescriptionProposalSection {
            section_id: section_id.to_string(),
            heading: String::new(),
            current_content: String::new(),
            proposed_content: proposed_content.to_string(),
            status: DescriptionSectionStatus::Raw,
            reviewer_comment: None,
            updated_at: None,
        }
    }
}
