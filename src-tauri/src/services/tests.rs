use super::AppServices;
use crate::attachment_storage::{AttachmentFileGrant, PERSONAL_V1_JIRA_ATTACHMENT_MAX_BYTES};
use crate::db::open_in_memory_database;
use crate::integrations::ai::{ai_model_or_default, AiProvider};
use crate::models::{AppSettings, LocalTask, NewSubtask, NewTask, NewTray, TrayState};
use crate::repositories::{TaskRepository, TrayRepository};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::Path;
use std::thread;
use uuid::Uuid;

fn serve_catalog_once(body: &'static str) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("test server binds");
    let address = listener.local_addr().expect("test server address");
    thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let response = format!(
                "HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: {}
Connection: close

{}",
                body.len(),
                body
            );
            stream
                .write_all(response.as_bytes())
                .expect("test server writes response");
        }
    });
    format!("http://{address}/jtf-sync-catalog.json")
}

fn attachment_grant(source_path: &Path) -> AttachmentFileGrant {
    AttachmentFileGrant::from_backend_file_dialog(source_path.to_path_buf())
}

fn create_attachment_test_task(services: &AppServices) -> LocalTask {
    let tray = services
        .create_tray(NewTray {
            name: "Attachment validation tray".to_string(),
        })
        .expect("tray creates");
    services
        .create_task(NewTask {
            tray_id: tray.id,
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Attachment validation task".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Bug".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates")
}

#[test]
fn manages_tray_lifecycle_through_services() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));

    let tray = services
        .create_tray(NewTray {
            name: "Service tray".to_string(),
        })
        .expect("tray creates");
    assert_eq!(
        services.list_trays().expect("trays list"),
        vec![tray.clone()]
    );

    let renamed = services
        .rename_tray(&tray.id, "Renamed service tray")
        .expect("tray renames")
        .expect("tray exists");
    assert_eq!(renamed.name, "Renamed service tray");

    let archived = services
        .archive_tray(&tray.id)
        .expect("tray archives")
        .expect("tray exists");
    assert_eq!(archived.state, TrayState::Archived);
    assert!(archived.archived_at.is_some());

    let restored = services
        .restore_tray(&tray.id)
        .expect("tray restores")
        .expect("tray exists");
    assert_eq!(restored.state, TrayState::Active);
    assert_eq!(restored.archived_at, None);

    assert!(services.delete_tray(&tray.id).expect("tray deletes"));
    assert!(services.list_trays().expect("trays list").is_empty());
}

#[test]
fn manages_task_lifecycle_through_services() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));
    let tray = services
        .create_tray(NewTray {
            name: "Task service tray".to_string(),
        })
        .expect("tray creates");
    let task = services
        .create_task(NewTask {
            tray_id: tray.id.clone(),
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Service task".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Bug".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates");

    assert_eq!(
        services.list_tasks().expect("tasks list"),
        vec![task.clone()]
    );

    let updated = services
        .update_task_details(
            &task.id,
            "PilotLab",
            "Programacion",
            "Updated service task",
            "High",
            "Story",
        )
        .expect("task updates")
        .expect("task remains editable");
    assert_eq!(updated.project, "PilotLab");
    assert_eq!(updated.area, "Programacion");
    assert_eq!(updated.title, "Updated service task");
    assert_eq!(updated.priority, "High");
    assert_eq!(updated.issue_type, "Story");

    let exported = services
        .mark_tasks_csv_exported(std::slice::from_ref(&task.id))
        .expect("task marks exported");
    assert_eq!(exported.len(), 1);
    assert_eq!(exported[0].sync_status, "Exported");

    assert!(services.delete_task(&task.id).expect("task deletes"));
    assert!(services.list_tasks().expect("tasks list").is_empty());
}

#[test]
fn stores_task_attachments_as_app_managed_files() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&source_dir).expect("source dir creates");
    let source_path = source_dir.join("source image.png");
    fs::write(&source_path, b"source attachment").expect("source file writes");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let tray = services
        .create_tray(NewTray {
            name: "Attachment service tray".to_string(),
        })
        .expect("tray creates");
    let task = services
        .create_task(NewTask {
            tray_id: tray.id,
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Service attachment task".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Bug".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates");

    let after_path_add = services
        .add_task_attachments_from_file_grants(
            &task.id,
            &[attachment_grant(&source_path)],
            "AI + Jira attachment",
        )
        .expect("attachment adds from path")
        .expect("task exists");
    assert_eq!(after_path_add.attachments.len(), 1);
    let stored_path = app_data_dir.join(&after_path_add.attachments[0].original_relative_path);
    assert!(stored_path.exists());
    assert_eq!(
        fs::read(&stored_path).expect("stored file reads"),
        b"source attachment"
    );

    let after_purpose_update = services
        .update_task_attachment_purpose(
            &task.id,
            &after_path_add.attachments[0].id,
            "Jira attachment",
        )
        .expect("attachment purpose updates")
        .expect("task exists");
    assert_eq!(
        after_purpose_update.attachments[0].purpose,
        "Jira attachment"
    );

    let after_delete = services
        .delete_task_attachment(&task.id, &after_path_add.attachments[0].id)
        .expect("attachment deletes")
        .expect("task exists");
    assert!(after_delete.attachments.is_empty());
    assert!(!stored_path.exists());

    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[test]
fn rejects_arbitrary_attachment_paths_without_backend_grant() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-ungranted-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-ungranted-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&source_dir).expect("source dir creates");
    let source_path = source_dir.join("ungranted.txt");
    fs::write(&source_path, b"ungranted attachment").expect("source file writes");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let task = create_attachment_test_task(&services);

    let error = services
        .add_task_attachments_from_paths(
            &task.id,
            &[source_path.to_string_lossy().to_string()],
            "Jira attachment",
        )
        .expect_err("ungranted paths reject");

    assert!(error.to_string().contains("backend file grant"));
    assert!(services
        .list_tasks()
        .expect("tasks list")
        .into_iter()
        .find(|candidate| candidate.id == task.id)
        .expect("task exists")
        .attachments
        .is_empty());
    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[test]
fn rejects_attachment_directories() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-directory-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-directory-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    let selected_directory = source_dir.join("not-a-file");
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&selected_directory).expect("selected directory creates");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let task = create_attachment_test_task(&services);

    let error = services
        .add_task_attachments_from_file_grants(
            &task.id,
            &[attachment_grant(&selected_directory)],
            "Jira attachment",
        )
        .expect_err("directory source rejects");

    assert!(error.to_string().contains("Only files"));
    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[cfg(unix)]
#[test]
fn rejects_attachment_symlinks_before_copying() {
    use std::os::unix::fs::symlink;

    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-symlink-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-symlink-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&source_dir).expect("source dir creates");
    let real_file = source_dir.join("real.txt");
    let symlink_path = source_dir.join("linked.txt");
    fs::write(&real_file, b"real attachment").expect("real file writes");
    symlink(&real_file, &symlink_path).expect("symlink creates");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let task = create_attachment_test_task(&services);

    let error = services
        .add_task_attachments_from_file_grants(
            &task.id,
            &[attachment_grant(&symlink_path)],
            "Jira attachment",
        )
        .expect_err("symlink source rejects");

    assert!(error.to_string().contains("symbolic link"));
    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[test]
fn rejects_oversized_jira_ready_attachment_sources() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-oversized-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-oversized-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&source_dir).expect("source dir creates");
    let source_path = source_dir.join("too-large.bin");
    let source_file = fs::File::create(&source_path).expect("source file creates");
    source_file
        .set_len(PERSONAL_V1_JIRA_ATTACHMENT_MAX_BYTES + 1)
        .expect("source file sizes");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let task = create_attachment_test_task(&services);

    let error = services
        .add_task_attachments_from_file_grants(
            &task.id,
            &[attachment_grant(&source_path)],
            "AI + Jira attachment",
        )
        .expect_err("oversized source rejects");

    assert!(error.to_string().contains("100 MB or smaller"));
    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[test]
fn rejects_attachment_sources_inside_internal_app_data() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-internal-attachment-test-{}",
        Uuid::new_v4()
    ));
    let internal_logs_dir = app_data_dir.join("logs");
    fs::create_dir_all(&internal_logs_dir).expect("internal logs dir creates");
    let source_path = internal_logs_dir.join("diagnostic.txt");
    fs::write(&source_path, b"internal diagnostics").expect("internal source writes");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let task = create_attachment_test_task(&services);

    let error = services
        .add_task_attachments_from_file_grants(
            &task.id,
            &[attachment_grant(&source_path)],
            "Jira attachment",
        )
        .expect_err("internal source rejects");

    assert!(error.to_string().contains("app data"));
    let _ = fs::remove_dir_all(&app_data_dir);
}

#[test]
fn deleting_task_removes_managed_attachment_files_for_task_graph() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-delete-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-delete-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&source_dir).expect("source dir creates");
    let parent_source_path = source_dir.join("parent.txt");
    let child_source_path = source_dir.join("child.txt");
    fs::write(&parent_source_path, b"parent attachment").expect("parent source writes");
    fs::write(&child_source_path, b"child attachment").expect("child source writes");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let tray = services
        .create_tray(NewTray {
            name: "Attachment delete tray".to_string(),
        })
        .expect("tray creates");
    let parent = services
        .create_task(NewTask {
            tray_id: tray.id,
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Parent with attachment".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Story".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("parent creates");
    let child = services
        .create_subtask(NewSubtask {
            parent_task_id: parent.id.clone(),
            title: "Child with attachment".to_string(),
        })
        .expect("subtask creates");
    let parent_with_attachment = services
        .add_task_attachments_from_file_grants(
            &parent.id,
            &[attachment_grant(&parent_source_path)],
            "Jira attachment",
        )
        .expect("parent attachment adds")
        .expect("parent exists");
    let child_with_attachment = services
        .add_task_attachments_from_file_grants(
            &child.id,
            &[attachment_grant(&child_source_path)],
            "Jira attachment",
        )
        .expect("child attachment adds")
        .expect("child exists");
    let parent_stored_path =
        app_data_dir.join(&parent_with_attachment.attachments[0].original_relative_path);
    let child_stored_path =
        app_data_dir.join(&child_with_attachment.attachments[0].original_relative_path);
    assert!(parent_stored_path.exists());
    assert!(child_stored_path.exists());

    assert!(services.delete_task(&parent.id).expect("task deletes"));

    assert!(!parent_stored_path.exists());
    assert!(!child_stored_path.exists());
    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[test]
fn deleting_tray_removes_managed_attachment_files() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-delete-tray-attachment-test-{}",
        Uuid::new_v4()
    ));
    let source_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-delete-tray-attachment-source-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    fs::create_dir_all(&source_dir).expect("source dir creates");
    let source_path = source_dir.join("tray-file.txt");
    fs::write(&source_path, b"tray attachment").expect("source writes");
    let services = AppServices::new_with_app_data_dir(
        open_in_memory_database().expect("database opens"),
        app_data_dir.clone(),
    );
    let tray = services
        .create_tray(NewTray {
            name: "Delete tray attachments".to_string(),
        })
        .expect("tray creates");
    let task = services
        .create_task(NewTask {
            tray_id: tray.id.clone(),
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Tray attachment task".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Story".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates");
    let task_with_attachment = services
        .add_task_attachments_from_file_grants(
            &task.id,
            &[attachment_grant(&source_path)],
            "Jira attachment",
        )
        .expect("attachment adds")
        .expect("task exists");
    let stored_path =
        app_data_dir.join(&task_with_attachment.attachments[0].original_relative_path);
    assert!(stored_path.exists());

    assert!(services.delete_tray(&tray.id).expect("tray deletes"));

    assert!(!stored_path.exists());
    let _ = fs::remove_dir_all(&app_data_dir);
    let _ = fs::remove_dir_all(&source_dir);
}

#[test]
fn unsafe_attachment_paths_do_not_delete_outside_files() {
    let app_data_dir = std::env::temp_dir().join(format!(
        "jira-task-forge-unsafe-delete-test-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&app_data_dir).expect("temp app data creates");
    let sentinel_path = app_data_dir.join("sentinel.txt");
    fs::write(&sentinel_path, b"keep me").expect("sentinel writes");
    let connection = open_in_memory_database().expect("database opens");
    let tray = TrayRepository::new(&connection)
        .create(NewTray {
            name: "Unsafe attachment delete".to_string(),
        })
        .expect("tray creates");
    let task = TaskRepository::new(&connection)
        .create(NewTask {
            tray_id: tray.id,
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Unsafe attachment task".to_string(),
            priority: "Medium".to_string(),
            issue_type: "Story".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates");
    connection
        .execute(
            "
            INSERT INTO attachments (
                id, task_id, display_filename, mime_type, purpose, original_size_bytes,
                original_relative_path, file_hash, restore_status, created_at, updated_at
            )
            VALUES ('attachment-unsafe', ?1, 'sentinel.txt', 'text/plain', 'Jira attachment', 7,
                    '../sentinel.txt', NULL, NULL, '2026-05-25T12:00:00Z', '2026-05-25T12:00:00Z')
            ",
            [task.id.as_str()],
        )
        .expect("unsafe metadata inserts");
    let services = AppServices::new_with_app_data_dir(connection, app_data_dir.clone());

    let error = services
        .delete_task_attachment(&task.id, "attachment-unsafe")
        .expect_err("unsafe path should block delete");

    assert!(error.to_string().contains("attachment path"));
    assert_eq!(
        fs::read(&sentinel_path).expect("sentinel reads"),
        b"keep me"
    );
    assert_eq!(
        services
            .list_tasks()
            .expect("tasks list")
            .first()
            .expect("task exists")
            .attachments
            .len(),
        1
    );
    let _ = fs::remove_dir_all(&app_data_dir);
}

#[test]
fn creates_recovery_trays_by_moving_retryable_tasks() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));
    let source_tray = services
        .create_tray(NewTray {
            name: "Source".to_string(),
        })
        .expect("source tray creates");
    let retryable_task = services
        .create_task(NewTask {
            tray_id: source_tray.id.clone(),
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "Retry me".to_string(),
            priority: "High".to_string(),
            issue_type: "Bug".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates");

    assert_eq!(
        services
            .create_recovery_tray_from_tasks(&source_tray.id, &[])
            .expect_err("empty task list should fail"),
        "No failed tasks were selected for recovery."
    );

    let recovery_tray = services
        .create_recovery_tray_from_tasks(&source_tray.id, std::slice::from_ref(&retryable_task.id))
        .expect("recovery tray creates");
    assert_eq!(recovery_tray.name, "Recovery - Source");

    let moved_task = services
        .list_tasks()
        .expect("tasks list")
        .into_iter()
        .find(|task| task.id == retryable_task.id)
        .expect("task remains");
    assert_eq!(moved_task.tray_id, recovery_tray.id);
}

#[test]
fn reads_and_updates_settings_through_services() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));

    assert_eq!(
        services
            .get_app_settings()
            .expect("default settings load")
            .jira_creation_project_key,
        ""
    );

    let updated = services
        .update_app_settings(AppSettings {
            theme_mode: "system".to_string(),
            jira_site_url: "https://example.atlassian.net".to_string(),
            jira_account_email: "saimon@example.com".to_string(),
            jira_auth_method: "api-token".to_string(),
            jira_creation_project_key: "JTFTEST".to_string(),
            ai_provider: "OpenAI".to_string(),
            ai_model: "gpt-4.1".to_string(),
            default_content_language: "Spanish".to_string(),
            ..AppSettings::default()
        })
        .expect("settings update");

    assert_eq!(updated.jira_creation_project_key, "JTFTEST");
    assert_eq!(
        services
            .get_app_settings()
            .expect("settings reload")
            .jira_account_email,
        "saimon@example.com"
    );
}

#[test]
fn manages_categories_and_jql_favorites_through_services() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));

    let category = services
        .create_category("project", "Animation")
        .expect("category creates");
    assert_eq!(category.name, "Animation");
    assert!(services
        .list_categories(Some("project"))
        .expect("categories list")
        .iter()
        .any(|candidate| candidate.id == category.id));

    let updated_category = services
        .update_category(&category.id, Some("Rigging"), Some(true))
        .expect("category updates")
        .expect("category exists");
    assert_eq!(updated_category.name, "Rigging");
    assert!(updated_category.hidden);

    let favorite = services
        .create_jql_favorite("Latest DTS", "project = DTS ORDER BY created DESC")
        .expect("favorite creates");
    let updated_favorite = services
        .update_jql_favorite(
            &favorite.id,
            Some("Latest JTFTEST"),
            Some("project = JTFTEST ORDER BY created DESC"),
        )
        .expect("favorite updates")
        .expect("favorite exists");
    assert_eq!(updated_favorite.name, "Latest JTFTEST");
    assert_eq!(
        updated_favorite.jql,
        "project = JTFTEST ORDER BY created DESC"
    );
    assert_eq!(
        services.list_jql_favorites().expect("favorites list").len(),
        1
    );

    assert!(services
        .delete_jql_favorite(&favorite.id)
        .expect("favorite deletes"));
    assert!(services
        .delete_category(&category.id)
        .expect("category deletes"));
}

#[test]
fn external_catalog_sync_preserves_manual_areas_and_removes_fallback_catalog_areas() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));
    let manual_area_name = "__manual_area_should_be_pruned__";
    services
        .create_category("area", manual_area_name)
        .expect("manual area creates");
    assert!(services
        .list_categories(Some("area"))
        .expect("areas list before sync")
        .iter()
        .any(|category| category.name == manual_area_name));

    let source_url = serve_catalog_once(
        r#"{
          "areas": [
            {
              "areaDisplayName": "Bug",
              "jiraLabel": "Bug",
              "enabledInJTF": true,
              "issueType": "Bug",
              "defaultDeliveryFormat": "Bug",
              "safeAliases": []
            },
            {
              "areaDisplayName": "Programación",
              "jiraLabel": "Programación",
              "enabledInJTF": true,
              "issueType": "Story",
              "defaultDeliveryFormat": "Feature de Programación",
              "safeAliases": ["Programacion"]
            }
          ],
          "deliveryFormats": [
            {
              "formatName": "Bug",
              "issueType": "Bug",
              "storyHeadings": ["Historia de usuario"],
              "minimumDeliverable": "Bug reproducible.",
              "reviewChecklist": ["Pasos de reproducción incluidos."]
            },
            {
              "formatName": "Feature de Programación",
              "issueType": "Story",
              "storyHeadings": ["Historia de usuario"],
              "minimumDeliverable": "PR/MR creado.",
              "reviewChecklist": ["PR/MR creado."]
            }
          ],
          "areaFormatRules": []
        }"#,
    );

    let result = services
        .sync_area_catalog_from_source(&source_url)
        .expect("external catalog sync succeeds");
    assert!(result.ok);
    assert_eq!(result.synced_area_count, 2);

    let areas = services
        .list_categories(Some("area"))
        .expect("areas list after sync");
    assert!(areas
        .iter()
        .any(|category| category.name == "Programación" && category.source == "catalog"));
    assert!(areas
        .iter()
        .any(|category| category.name == "Bug" && category.source == "catalog"));
    assert!(areas
        .iter()
        .any(|category| category.name == manual_area_name && category.source == "local"));
    assert!(!areas.iter().any(|category| category.name == "3D"));
}

#[test]
fn delivery_format_gate_is_auto_without_synced_notion_templates() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));

    let gate = services
        .resolve_delivery_format_gate("3D", "Entregar zip para integración manual")
        .expect("fallback gate resolves");

    assert_eq!(gate.kind, "auto");
    assert_eq!(gate.area_display_name, "3D");
    assert_eq!(gate.format, None);
    assert!(gate.options.is_empty());
}

#[test]
fn delivery_format_gate_requires_confirmation_when_synced_templates_exist() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));
    let source_url = serve_catalog_once(
        r#"{
          "areas": [
            {
              "areaDisplayName": "Bug",
              "jiraLabel": "Bug",
              "enabledInJTF": true,
              "issueType": "Bug",
              "defaultDeliveryFormat": "Bug",
              "safeAliases": ["bug"]
            },
            {
              "areaDisplayName": "3D",
              "jiraLabel": "3D",
              "enabledInJTF": true,
              "issueType": "Story",
              "defaultDeliveryFormat": "Arte Integrado",
              "safeAliases": ["Modelos 3D"]
            }
          ],
          "deliveryFormats": [
            {
              "formatName": "Bug",
              "issueType": "Bug",
              "storyHeadings": ["Problema"],
              "minimumDeliverable": "Corrección verificable.",
              "reviewChecklist": ["Pasos claros."]
            },
            {
              "formatName": "Arte Integrado",
              "issueType": "Story",
              "storyHeadings": ["Historia de usuario"],
              "minimumDeliverable": "PR/MR con assets integrados.",
              "reviewChecklist": ["PR/MR creado."]
            },
            {
              "formatName": "Arte Empaquetado",
              "issueType": "Story",
              "storyHeadings": ["Historia de usuario"],
              "minimumDeliverable": "Zip disponible.",
              "reviewChecklist": ["Zip disponible."]
            }
          ],
          "areaFormatRules": [
            {
              "areaDisplayName": "3D",
              "order": 1,
              "condition": "if delivered as a package for another person to integrate",
              "deliveryFormat": "Arte Empaquetado",
              "blocking": false
            },
            {
              "areaDisplayName": "3D",
              "order": 2,
              "condition": "fallback",
              "deliveryFormat": "Arte Integrado",
              "blocking": false
            }
          ]
        }"#,
    );
    let result = services
        .sync_area_catalog_from_source(&source_url)
        .expect("catalog sync succeeds");
    assert!(result.ok);

    let gate = services
        .resolve_delivery_format_gate("3D", "Entregar zip para integración manual")
        .expect("synced gate resolves");

    assert_eq!(gate.kind, "needs_confirmation");
    assert_eq!(gate.format, None);
    assert_eq!(gate.suggested_format, None);
    assert_eq!(
        gate.options,
        vec!["Arte Integrado".to_string(), "Arte Empaquetado".to_string()]
    );
}

#[test]
fn exports_and_imports_backup_files_through_services() {
    let source_services = AppServices::new(open_in_memory_database().expect("database opens"));
    let tray = source_services
        .create_tray(NewTray {
            name: "File backup tray".to_string(),
        })
        .expect("tray creates");
    source_services
        .create_task(NewTask {
            tray_id: tray.id,
            project: "STT".to_string(),
            area: "Bug".to_string(),
            title: "File backup task".to_string(),
            priority: "High".to_string(),
            issue_type: "Bug".to_string(),
            content_language: "Spanish".to_string(),
        })
        .expect("task creates");
    let path = std::env::temp_dir().join(format!(
        "jira-task-forge-backup-{}.json",
        uuid::Uuid::new_v4()
    ));
    let path_string = path.to_string_lossy().to_string();

    let export_result = source_services
        .export_backup_file(&path_string, Some("0.1.0-test".to_string()))
        .expect("backup exports");
    assert_eq!(export_result.path, path_string);
    assert!(!export_result.secrets_included);
    assert_eq!(export_result.record_counts["trays"], 1);

    let target_services = AppServices::new(open_in_memory_database().expect("database opens"));
    let import_result = target_services
        .import_backup_file(&path_string)
        .expect("backup imports");
    assert_eq!(import_result.imported_counts["trays"], 1);
    assert_eq!(
        target_services
            .list_tasks()
            .expect("tasks list")
            .first()
            .expect("task imported")
            .title,
        "File backup task"
    );

    std::fs::remove_file(path).expect("backup file cleanup");
}

#[test]
fn rejects_invalid_backup_file_inputs_through_services() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));

    assert_eq!(
        services
            .export_backup_file("   ", None)
            .expect_err("empty export path rejected"),
        "Backup path cannot be empty."
    );
    assert_eq!(
        services
            .import_backup_file("   ")
            .expect_err("empty import path rejected"),
        "Backup path cannot be empty."
    );

    let path = std::env::temp_dir().join(format!(
        "jira-task-forge-invalid-backup-{}.json",
        uuid::Uuid::new_v4()
    ));
    std::fs::write(&path, "not json").expect("invalid backup writes");

    let error = services
        .import_backup_file(&path.to_string_lossy())
        .expect_err("invalid json rejected");
    assert!(error.starts_with("Could not parse backup file:"));

    std::fs::remove_file(path).expect("invalid backup cleanup");
}

#[test]
fn defaults_ai_models_by_provider_when_blank() {
    assert_eq!(ai_model_or_default(AiProvider::OpenAi, ""), "gpt-4.1");
    assert_eq!(
        ai_model_or_default(AiProvider::Claude, "   "),
        "claude-sonnet-4-20250514"
    );
    assert_eq!(
        ai_model_or_default(AiProvider::Gemini, ""),
        "gemini-2.5-flash"
    );
    assert_eq!(
        ai_model_or_default(AiProvider::OpenAi, "  gpt-4.1-mini  "),
        "gpt-4.1-mini"
    );
}

#[test]
fn returns_early_ai_provider_errors_before_keyring_or_network_work() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));
    services
        .update_app_settings(AppSettings {
            ai_provider: "None".to_string(),
            ..AppSettings::default()
        })
        .expect("settings update");

    assert_eq!(
        services
            .test_ai_provider_connection()
            .expect_err("provider must be selected"),
        "Select an AI provider before using AI."
    );
    assert_eq!(
        services
            .test_ai_provider_connection_with_api_key("None", "unsaved-key")
            .expect_err("provider must be selected"),
        "Select an AI provider before using AI."
    );
    assert_eq!(
        services
            .list_ai_provider_models("None", None)
            .expect_err("provider must be selected"),
        "Select an AI provider before using AI."
    );
    assert_eq!(
        services
            .draft_jql_with_ai("show latest DTS issue")
            .expect_err("provider must be selected"),
        "Select an AI provider before using AI."
    );

    services
        .update_app_settings(AppSettings {
            ai_provider: "OpenAI".to_string(),
            ..AppSettings::default()
        })
        .expect("settings update");
    assert_eq!(
        services
            .test_ai_provider_connection_with_api_key("OpenAI", "   ")
            .expect_err("empty draft key rejected"),
        "OpenAI API key cannot be empty."
    );
    assert_eq!(
        services
            .test_ai_provider_connection_with_api_key("Claude", "   ")
            .expect_err("empty draft key rejected"),
        "Claude API key cannot be empty."
    );

    let claude_models = services
        .list_ai_provider_models("Claude", Some("unsaved-key"))
        .expect("claude fallback model list resolves without network");
    assert!(claude_models.contains(&"claude-sonnet-4-20250514".to_string()));
}

#[test]
fn returns_early_jira_errors_before_keyring_or_network_work() {
    let services = AppServices::new(open_in_memory_database().expect("database opens"));
    let tray = services
        .create_tray(NewTray {
            name: "Jira early errors".to_string(),
        })
        .expect("tray creates");

    assert_eq!(
        services
            .create_jira_parent_issues(&tray.id, true, true, true)
            .expect_err("missing project key should fail"),
        "Jira creation project key is required."
    );

    let connection_result = services.test_jira_connection();
    assert!(!connection_result.ok);
    assert_eq!(connection_result.message, "Jira account email is required.");

    assert_eq!(
        services
            .run_jql_query("project = JTFTEST", 50)
            .expect_err("missing email should fail"),
        "Jira account email is required."
    );

    let draft_token_result = services.test_jira_connection_with_api_token("   ", None, None);
    assert!(!draft_token_result.ok);
    assert_eq!(
        draft_token_result.message,
        "Jira API token cannot be empty."
    );

    let draft_email_result = services.test_jira_connection_with_api_token(
        "token-123",
        Some("https://salmonsimondts.atlassian.net"),
        Some("  "),
    );
    assert!(!draft_email_result.ok);
    assert_eq!(
        draft_email_result.message,
        "Jira account email is required."
    );

    services
        .update_app_settings(AppSettings {
            jira_creation_project_key: "JTFTEST".to_string(),
            ..AppSettings::default()
        })
        .expect("settings update");
    assert_eq!(
        services
            .create_jira_parent_issues(&tray.id, true, true, true)
            .expect_err("missing email should fail"),
        "Jira account email is required."
    );
}
