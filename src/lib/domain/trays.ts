import type { LocalTask, Tray, TrayState } from "../types";

export type TrayStatusTag = TrayState | "Exported";
export type TaskSummaryInput = Pick<LocalTask, "issueType" | "parentTaskId" | "syncStatus">;

export function isTrayComplete(tasks: Pick<LocalTask, "syncStatus">[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.syncStatus === "Created");
}

export function deriveTrayStateFromTasks(
  tasks: Pick<LocalTask, "syncStatus">[],
  currentState: TrayState = "Active"
): TrayState {
  if (currentState === "Archived") return "Archived";
  if (isTrayComplete(tasks)) return "Completed";
  if (tasks.some((task) => task.syncStatus === "Failed")) return "Needs attention";
  return "Active";
}

export function deriveTrayStatusTag(
  tasks: Pick<LocalTask, "syncStatus">[],
  currentState: TrayState = "Active"
): TrayStatusTag {
  const state = deriveTrayStateFromTasks(tasks, currentState);
  if (state !== "Active") return state;
  const hasExportedTasks = tasks.some((task) => task.syncStatus === "Exported");
  const hasPendingTasks = tasks.some((task) => task.syncStatus === "Pending");
  if (hasExportedTasks && !hasPendingTasks) return "Exported";
  return state;
}

export function countTasksBySyncStatus(
  tasks: Pick<LocalTask, "syncStatus">[]
): Record<LocalTask["syncStatus"], number> {
  return tasks.reduce(
    (summary, task) => {
      summary[task.syncStatus] += 1;
      return summary;
    },
    { Pending: 0, Failed: 0, Exported: 0, Created: 0 } satisfies Record<LocalTask["syncStatus"], number>
  );
}

export function summarizeTrayTasks(tasks: TaskSummaryInput[]): string {
  const parentTasks = tasks.filter((task) => task.issueType !== "Sub-task" && !task.parentTaskId);
  const subtaskCount = tasks.length - parentTasks.length;
  if (parentTasks.length === 0 && subtaskCount === 0) return "No tasks";

  const counts = countTasksBySyncStatus(parentTasks);

  return [
    `${parentTasks.length} ${parentTasks.length === 1 ? "task" : "tasks"}`,
    subtaskCount ? `${subtaskCount} ${subtaskCount === 1 ? "sub-task" : "sub-tasks"}` : null,
    counts.Pending ? `${counts.Pending} pending` : null,
    counts.Failed ? `${counts.Failed} failed` : null,
    counts.Exported ? `${counts.Exported} exported` : null,
    counts.Created ? `${counts.Created} created` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

export function updateTrayTasks(tray: Tray, tasks: LocalTask[]): Tray {
  return {
    ...tray,
    tasks,
    state: deriveTrayStateFromTasks(tasks, tray.state),
    summary: summarizeTrayTasks(tasks),
    updatedAt: "Just now"
  };
}
