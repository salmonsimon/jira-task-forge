import { invoke } from "@tauri-apps/api/core";
import type {
  AiProvider,
  AppSettings,
  AttachmentPurpose,
  AssistedDescriptionDraft,
  AssistedDescriptionProposal,
  AssistedDescriptionProposalStatus,
  CatalogSyncResult,
  Category,
  DescriptionProposalLogEntry,
  DescriptionSectionStatus,
  JqlAiDraft,
  JiraCreateIssuesResult,
  JiraConnectionTestResult,
  JiraProjectOption,
  JqlFavorite,
  JqlQueryResult,
  LocalTask,
  LocalIssueRelationship,
  NewAssistedDescriptionProposal,
  SyncLogEntry,
  Tray
} from "../types";
import {
  mapBackendAssistedDescriptionProposal as mapAssistedDescriptionProposal,
  mapBackendCategory as mapCategory,
  mapBackendDescriptionProposalLogEntry as mapDescriptionProposalLogEntry,
  mapBackendJqlFavorite as mapJqlFavorite,
  mapBackendSyncAuditEvent as mapSyncAuditEvent,
  mapBackendTask as mapTask,
  mapBackendTray as mapTray,
  type BackendAssistedDescriptionProposal,
  type BackendCategory,
  type BackendDescriptionProposalLogEntry,
  type BackendJqlFavorite,
  type BackendSyncAuditEvent,
  type BackendTask,
  type BackendTray
} from "./tauriContracts";

export type PersistedBackupExportResult = {
  path: string;
  recordCounts: Record<string, number>;
  secretsIncluded: boolean;
};

export type PersistedBackupImportResult = {
  importedCounts: Record<string, number>;
  skippedCounts: Record<string, number>;
  warnings: string[];
};

export async function listPersistedTrays(): Promise<Tray[]> {
  const [backendTrays, backendTasks] = await Promise.all([
    invoke<BackendTray[]>("list_trays"),
    invoke<BackendTask[]>("list_tasks")
  ]);
  const tasksByTray = new Map<string, LocalTask[]>();

  for (const task of backendTasks) {
    const tasks = tasksByTray.get(task.tray_id) ?? [];
    tasks.push(mapTask(task));
    tasksByTray.set(task.tray_id, tasks);
  }

  return backendTrays.map((tray) => {
    const tasks = tasksByTray.get(tray.id) ?? [];
    return mapTray(tray, tasks);
  });
}

export async function createPersistedTray(name: string): Promise<Tray> {
  const tray = await invoke<BackendTray>("create_tray", { name });
  return mapTray(tray, []);
}

export async function renamePersistedTray(trayId: string, name: string): Promise<Tray | null> {
  const tray = await invoke<BackendTray | null>("rename_tray", { trayId, name });
  if (!tray) return null;

  return mapTray(tray, []);
}

export async function archivePersistedTray(trayId: string): Promise<Tray | null> {
  const tray = await invoke<BackendTray | null>("archive_tray", { trayId });
  return tray ? mapTray(tray, []) : null;
}

export async function restorePersistedTray(trayId: string): Promise<Tray | null> {
  const tray = await invoke<BackendTray | null>("restore_tray", { trayId });
  return tray ? mapTray(tray, []) : null;
}

export async function deletePersistedTray(trayId: string): Promise<boolean> {
  return invoke<boolean>("delete_tray", { trayId });
}

export async function getPersistedAppSettings(): Promise<AppSettings> {
  return normalizeAppSettings(await invoke<AppSettings>("get_app_settings"));
}

export async function updatePersistedAppSettings(settings: AppSettings): Promise<AppSettings> {
  return normalizeAppSettings(await invoke<AppSettings>("update_app_settings", { settings }));
}

export async function listPersistedCategories(categoryType?: "project" | "area"): Promise<Category[]> {
  const categories = await invoke<BackendCategory[]>("list_categories", { categoryType });
  return categories.map(mapCategory);
}

export async function createPersistedCategory(categoryType: "project" | "area", name: string): Promise<Category> {
  return mapCategory(await invoke<BackendCategory>("create_category", { categoryType, name }));
}

export async function updatePersistedCategory(
  id: string,
  patch: Partial<Pick<Category, "hidden" | "name">>
): Promise<Category | null> {
  const category = await invoke<BackendCategory | null>("update_category", {
    id,
    name: patch.name,
    hidden: patch.hidden
  });
  return category ? mapCategory(category) : null;
}

export async function deletePersistedCategory(id: string): Promise<boolean> {
  return invoke<boolean>("delete_category", { id });
}

export async function syncPersistedAreaCatalog(): Promise<Category[]> {
  const categories = await invoke<BackendCategory[]>("sync_area_catalog");
  return categories.map(mapCategory);
}

export async function syncPersistedAreaCatalogFromSource(sourceUrl: string): Promise<CatalogSyncResult> {
  return invoke<CatalogSyncResult>("sync_area_catalog_from_source", { sourceUrl });
}

export async function listPersistedJqlFavorites(): Promise<JqlFavorite[]> {
  return (await invoke<BackendJqlFavorite[]>("list_jql_favorites")).map(mapJqlFavorite);
}

export async function createPersistedJqlFavorite(name: string, jql: string): Promise<JqlFavorite> {
  return mapJqlFavorite(await invoke<BackendJqlFavorite>("create_jql_favorite", { name, jql }));
}

export async function updatePersistedJqlFavorite(
  id: string,
  patch: Partial<Pick<JqlFavorite, "jql" | "name">>
): Promise<JqlFavorite | null> {
  const favorite = await invoke<BackendJqlFavorite | null>("update_jql_favorite", {
    id,
    name: patch.name,
    jql: patch.jql
  });
  return favorite ? mapJqlFavorite(favorite) : null;
}

export async function deletePersistedJqlFavorite(id: string): Promise<boolean> {
  return invoke<boolean>("delete_jql_favorite", { id });
}

export async function hasPersistedJiraApiToken(): Promise<boolean> {
  return invoke<boolean>("has_jira_api_token");
}

export async function savePersistedJiraApiToken(token: string): Promise<void> {
  await invoke("save_jira_api_token", { token });
}

export async function deletePersistedJiraApiToken(): Promise<void> {
  await invoke("delete_jira_api_token");
}

export async function hasPersistedOpenAiApiKey(): Promise<boolean> {
  return hasPersistedAiProviderApiKey("OpenAI");
}

export async function hasPersistedAiProviderApiKey(aiProvider: AiProvider): Promise<boolean> {
  if (aiProvider === "None") return false;
  return invoke<boolean>("has_ai_provider_api_key", { aiProvider });
}

export async function savePersistedOpenAiApiKey(apiKey: string): Promise<void> {
  await savePersistedAiProviderApiKey("OpenAI", apiKey);
}

export async function savePersistedAiProviderApiKey(aiProvider: AiProvider, apiKey: string): Promise<void> {
  await invoke("save_ai_provider_api_key", { aiProvider, apiKey });
}

export async function deletePersistedOpenAiApiKey(): Promise<void> {
  await deletePersistedAiProviderApiKey("OpenAI");
}

export async function deletePersistedAiProviderApiKey(aiProvider: AiProvider): Promise<void> {
  await invoke("delete_ai_provider_api_key", { aiProvider });
}

export async function testPersistedOpenAiConnection(): Promise<string> {
  return testPersistedAiProviderConnection();
}

export async function testPersistedAiProviderConnection(): Promise<string> {
  return invoke<string>("test_ai_provider_connection");
}

export async function testPersistedOpenAiApiKey(apiKey: string): Promise<string> {
  return testPersistedAiProviderApiKey("OpenAI", apiKey);
}

export async function testPersistedAiProviderApiKey(aiProvider: AiProvider, apiKey: string): Promise<string> {
  return invoke<string>("test_ai_provider_api_key", { aiProvider, apiKey });
}

export async function testPersistedJiraConnection(): Promise<JiraConnectionTestResult> {
  return invoke<JiraConnectionTestResult>("test_jira_connection");
}

export async function testPersistedJiraApiToken(token: string): Promise<JiraConnectionTestResult> {
  return invoke<JiraConnectionTestResult>("test_jira_api_token", { token });
}

export async function testPersistedJiraConnectionSettings(
  siteUrl: string,
  accountEmail: string
): Promise<JiraConnectionTestResult> {
  return invoke<JiraConnectionTestResult>("test_jira_connection_settings", { siteUrl, accountEmail });
}

export async function listPersistedJiraProjectsForConnection(
  siteUrl: string,
  accountEmail: string
): Promise<JiraProjectOption[]> {
  return invoke<JiraProjectOption[]>("list_jira_projects_for_connection", { siteUrl, accountEmail });
}

export async function runPersistedJqlQuery(jql: string, maxResults = 50): Promise<JqlQueryResult> {
  return invoke<JqlQueryResult>("run_jql_query", { jql, maxResults });
}

export async function draftPersistedJqlWithAi(prompt: string): Promise<JqlAiDraft> {
  return invoke<JqlAiDraft>("draft_jql_with_ai", { prompt });
}

export async function generatePersistedTaskDescription(
  taskId: string,
  additionalContext: string
): Promise<AssistedDescriptionDraft> {
  return invoke<AssistedDescriptionDraft>("generate_task_description", {
    taskId,
    additionalContext
  });
}

export async function createPersistedAssistedDescriptionProposal(
  proposal: NewAssistedDescriptionProposal
): Promise<AssistedDescriptionProposal> {
  const persisted = await invoke<BackendAssistedDescriptionProposal>("create_assisted_description_proposal", proposal);
  return mapAssistedDescriptionProposal(persisted);
}

export async function listPersistedAssistedDescriptionProposals(
  taskId: string
): Promise<AssistedDescriptionProposal[]> {
  const proposals = await invoke<BackendAssistedDescriptionProposal[]>("list_assisted_description_proposals", {
    taskId
  });
  return proposals.map(mapAssistedDescriptionProposal);
}

export async function listPersistedDescriptionProposalLog(taskId: string): Promise<DescriptionProposalLogEntry[]> {
  const entries = await invoke<BackendDescriptionProposalLogEntry[]>("list_description_proposal_log", { taskId });
  return entries.map(mapDescriptionProposalLogEntry);
}

export async function updatePersistedAssistedDescriptionProposalSection(
  proposalId: string,
  sectionId: string,
  patch: {
    proposedContent?: string | null;
    status?: DescriptionSectionStatus | null;
    reviewerComment?: string | null;
    applyToTaskDescription?: boolean;
  }
): Promise<AssistedDescriptionProposal | null> {
  const updated = await invoke<BackendAssistedDescriptionProposal | null>(
    "update_assisted_description_proposal_section",
    {
      proposalId,
      sectionId,
      proposedContent: patch.proposedContent,
      status: patch.status,
      reviewerComment: patch.reviewerComment,
      applyToTaskDescription: patch.applyToTaskDescription ?? false
    }
  );
  return updated ? mapAssistedDescriptionProposal(updated) : null;
}

export async function transitionPersistedAssistedDescriptionProposal(
  proposalId: string,
  status: AssistedDescriptionProposalStatus,
  options: {
    reviewerComment?: string | null;
    applyToTaskDescription?: boolean;
  } = {}
): Promise<AssistedDescriptionProposal | null> {
  const updated = await invoke<BackendAssistedDescriptionProposal | null>(
    "transition_assisted_description_proposal",
    {
      proposalId,
      status,
      reviewerComment: options.reviewerComment,
      applyToTaskDescription: options.applyToTaskDescription ?? (status === "Accepted" || status === "Partial")
    }
  );
  return updated ? mapAssistedDescriptionProposal(updated) : null;
}

export async function deletePersistedAssistedDescriptionProposal(proposalId: string): Promise<boolean> {
  return invoke<boolean>("delete_assisted_description_proposal", { proposalId });
}

export async function createPersistedJiraParentIssues(
  trayId: string,
  allowMissingDescriptions: boolean,
  includeExportedTasks: boolean,
  includeMissingDescriptionTasks: boolean
): Promise<JiraCreateIssuesResult> {
  return invoke<JiraCreateIssuesResult>("create_jira_parent_issues", {
    trayId,
    allowMissingDescriptions,
    includeExportedTasks,
    includeMissingDescriptionTasks
  });
}

export async function openPersistedAtlassianApiTokensPage(): Promise<void> {
  await invoke("open_atlassian_api_tokens_page");
}

export async function openPersistedAiProviderApiKeysPage(aiProvider: AppSettings["aiProvider"]): Promise<void> {
  await invoke("open_ai_provider_api_keys_page", { aiProvider });
}

export async function openPersistedJiraIssueUrl(url: string): Promise<void> {
  await invoke("open_jira_issue_url", { url });
}

export async function createPersistedTask(
  task: Pick<LocalTask, "project" | "area" | "title" | "priority" | "issueType" | "language">,
  trayId: string
): Promise<LocalTask> {
  const persisted = await invoke<BackendTask>("create_task", {
    trayId,
    project: task.project,
    area: task.area,
    title: task.title,
    priority: task.priority,
    issueType: task.issueType,
    contentLanguage: task.language
  });

  return mapTask(persisted);
}

export async function createPersistedSubtask(parentTaskId: string, title: string): Promise<LocalTask> {
  const persisted = await invoke<BackendTask>("create_subtask", {
    parentTaskId,
    title
  });

  return mapTask(persisted);
}

export async function deletePersistedTask(taskId: string): Promise<boolean> {
  return invoke<boolean>("delete_task", { taskId });
}

export async function updatePersistedTaskDetails(
  taskId: string,
  task: Pick<LocalTask, "area" | "issueType" | "priority" | "project" | "title">
): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("update_task_details", {
    taskId,
    project: task.project,
    area: task.area,
    title: task.title,
    priority: task.priority,
    issueType: task.issueType
  });

  return updated ? mapTask(updated) : null;
}

export async function updatePersistedTaskDescription(
  taskId: string,
  description: string | null,
  descriptionStatus: LocalTask["descriptionStatus"]
): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("update_task_description", {
    taskId,
    description,
    descriptionStatus
  });

  return updated ? mapTask(updated) : null;
}

export async function updatePersistedTaskIssueRelationships(
  taskId: string,
  issueRelationships: LocalIssueRelationship[]
): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("update_task_issue_relationships", {
    taskId,
    issueRelationships: issueRelationships.map((relationship) => ({
      id: relationship.id,
      relationship_type: relationship.type,
      target_task_id: relationship.targetTaskId
    }))
  });

  return updated ? mapTask(updated) : null;
}

export async function choosePersistedTaskAttachmentFiles(
  taskId: string,
  purpose: AttachmentPurpose
): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("choose_task_attachment_files", {
    taskId,
    purpose
  });
  return updated ? mapTask(updated) : null;
}

export async function updatePersistedTaskAttachmentPurpose(
  taskId: string,
  attachmentId: string,
  purpose: AttachmentPurpose
): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("update_task_attachment_purpose", {
    taskId,
    attachmentId,
    purpose
  });
  return updated ? mapTask(updated) : null;
}

export async function deletePersistedTaskAttachment(taskId: string, attachmentId: string): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("delete_task_attachment", {
    taskId,
    attachmentId
  });
  return updated ? mapTask(updated) : null;
}

export async function markPersistedTasksCsvExported(taskIds: string[]): Promise<LocalTask[]> {
  const tasks = await invoke<BackendTask[]>("mark_tasks_csv_exported", { taskIds });
  return tasks.map(mapTask);
}

export async function createPersistedRecoveryTrayFromTasks(sourceTrayId: string, taskIds: string[]): Promise<Tray> {
  const tray = await invoke<BackendTray>("create_recovery_tray_from_tasks", { sourceTrayId, taskIds });
  return mapTray(tray, []);
}

export async function listPersistedTaskSyncLog(taskId: string): Promise<SyncLogEntry[]> {
  const events = await invoke<BackendSyncAuditEvent[]>("list_task_sync_audit_events", { taskId });
  return events.map(mapSyncAuditEvent);
}

export async function exportPersistedBackup(path: string): Promise<PersistedBackupExportResult> {
  return invoke<PersistedBackupExportResult>("export_backup", { path });
}

export async function importPersistedBackup(path: string): Promise<PersistedBackupImportResult> {
  return invoke<PersistedBackupImportResult>("import_backup", { path });
}

export async function saveCsvFile(path: string, contents: string): Promise<void> {
  await invoke("save_csv_file", { path, contents });
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  const legacySettings = settings as AppSettings & {
    jiraSandboxProjectKey?: string;
  };

  return {
    ...settings,
    jiraCreationProjectKey: settings.jiraCreationProjectKey ?? legacySettings.jiraSandboxProjectKey ?? "",
    catalogSourceMode: settings.catalogSourceMode ?? "public-exportable",
    catalogSourceUrl: settings.catalogSourceUrl ?? ""
  };
}
