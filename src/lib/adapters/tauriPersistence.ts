import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, IssueType, LocalTask, Priority, SyncStatus, Tray, TrayState } from "../types";

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
  content_language: "Spanish" | "English";
  jira_key: string | null;
  epic_key: string | null;
  task_order: number;
  created_at: string;
  updated_at: string;
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
  return invoke<AppSettings>("get_app_settings");
}

export async function updatePersistedAppSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("update_app_settings", { settings });
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
  task: Pick<LocalTask, "project" | "area" | "priority">
): Promise<LocalTask | null> {
  const updated = await invoke<BackendTask | null>("update_task_details", {
    taskId,
    project: task.project,
    area: task.area,
    priority: task.priority
  });

  return updated ? mapTask(updated) : null;
}

export async function markPersistedTasksCsvExported(taskIds: string[]): Promise<LocalTask[]> {
  const tasks = await invoke<BackendTask[]>("mark_tasks_csv_exported", { taskIds });
  return tasks.map(mapTask);
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
    language: task.content_language,
    jiraKey: task.jira_key ?? undefined,
    epic: task.epic_key ?? undefined
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
