import { invoke } from "@tauri-apps/api/core";
import type {
  AiProvider,
  AppSettings,
  AssistedDescriptionDraft,
  Category,
  IssueType,
  JqlAiDraft,
  JiraCreateIssuesResult,
  JiraConnectionTestResult,
  JqlFavorite,
  JqlQueryResult,
  LocalTask,
  Priority,
  SyncLogEntry,
  SyncStatus,
  Tray,
  TrayState
} from "../types";

type BackendTray = {
  id: string;
  name: string;
  state: "Active" | "NeedsAttention" | "Completed" | "Archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

type BackendTask = {
  id: string;
  tray_id: string;
  project: string;
  area: string;
  title: string;
  priority: Priority;
  issue_type: IssueType;
  sync_status: SyncStatus;
  description_status: "Ready" | "Missing" | "Draft";
  description: string | null;
  content_language: "Spanish" | "English";
  jira_key: string | null;
  jira_url: string | null;
  epic_key: string | null;
  task_order: number;
  created_at: string;
  updated_at: string;
};

type BackendCategory = {
  id: string;
  category_type: "project" | "area";
  name: string;
  source: "local" | "jira";
  hidden: boolean;
  ignored: boolean;
  created_at: string;
  updated_at: string;
};

type BackendJqlFavorite = {
  id: string;
  name: string;
  jql: string;
  created_at: string;
  updated_at: string;
};

type BackendSyncAuditEvent = {
  id: string;
  syncAttemptId: string | null;
  trayId: string | null;
  taskId: string | null;
  eventType: string;
  occurredAt: string;
  outcome: string;
  provider: string | null;
  operation: string | null;
  detail: unknown;
};

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

export async function createPersistedJiraParentIssues(
  trayId: string,
  allowMissingDescriptions: boolean,
  includeExportedTasks: boolean
): Promise<JiraCreateIssuesResult> {
  return invoke<JiraCreateIssuesResult>("create_jira_parent_issues", {
    trayId,
    allowMissingDescriptions,
    includeExportedTasks
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

function mapTask(task: BackendTask): LocalTask {
  return {
    id: task.id,
    project: task.project,
    area: task.area,
    title: task.title,
    priority: task.priority,
    issueType: task.issue_type,
    syncStatus: task.sync_status,
    descriptionStatus: task.description_status,
    description: task.description ?? undefined,
    language: task.content_language,
    jiraKey: task.jira_key ?? undefined,
    jiraUrl: task.jira_url ?? undefined,
    epic: task.epic_key ?? undefined
  };
}

function mapCategory(category: BackendCategory): Category {
  return {
    id: category.id,
    categoryType: category.category_type,
    name: category.name,
    source: category.source,
    hidden: category.hidden
  };
}

function mapJqlFavorite(favorite: BackendJqlFavorite): JqlFavorite {
  return {
    id: favorite.id,
    name: favorite.name,
    jql: favorite.jql
  };
}

function mapSyncAuditEvent(event: BackendSyncAuditEvent): SyncLogEntry {
  return {
    id: event.id,
    timestamp: formatTimestamp(event.occurredAt),
    event: formatAuditEventTitle(event),
    detail: formatAuditEventDetail(event.detail)
  };
}

function mapTray(tray: BackendTray, tasks: LocalTask[]): Tray {
  return {
    id: tray.id,
    name: tray.name,
    state: mapTrayState(tray.state),
    summary: summarizeTrayTasks(tasks),
    updatedAt: formatTimestamp(tray.updated_at),
    tasks
  };
}

function formatAuditEventTitle(event: BackendSyncAuditEvent): string {
  const eventName = event.eventType
    .replace(/^jira\./, "")
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const outcome = event.outcome.charAt(0).toUpperCase() + event.outcome.slice(1);
  return `${outcome}: ${eventName}`;
}

function formatAuditEventDetail(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const value = detail as Record<string, unknown>;

  if (typeof value.message === "string") return value.message;
  if (Array.isArray(value.messages)) return value.messages.filter((message) => typeof message === "string").join(" ");

  const summaryParts = [
    typeof value.jiraKey === "string" ? value.jiraKey : null,
    typeof value.summary === "string" ? value.summary : null,
    typeof value.priority === "string" ? `Priority ${value.priority}` : null,
    typeof value.source === "string" ? `Source ${value.source}` : null
  ].filter(Boolean);

  return summaryParts.length ? summaryParts.join(" · ") : "No additional details.";
}

function mapTrayState(state: BackendTray["state"]): TrayState {
  if (state === "NeedsAttention") return "Needs attention";
  return state;
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function summarizeTrayTasks(tasks: LocalTask[]): string {
  if (tasks.length === 0) return "No tasks";

  const counts = tasks.reduce(
    (summary, task) => {
      summary[task.syncStatus] += 1;
      return summary;
    },
    { Pending: 0, Failed: 0, Exported: 0, Created: 0 } satisfies Record<LocalTask["syncStatus"], number>
  );

  return [
    `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
    counts.Pending ? `${counts.Pending} pending` : null,
    counts.Failed ? `${counts.Failed} failed` : null,
    counts.Exported ? `${counts.Exported} exported` : null,
    counts.Created ? `${counts.Created} created` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  const legacySettings = settings as AppSettings & {
    jiraSandboxProjectKey?: string;
  };

  return {
    ...settings,
    jiraCreationProjectKey: settings.jiraCreationProjectKey ?? legacySettings.jiraSandboxProjectKey ?? ""
  };
}
