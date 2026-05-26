import type { LocalTask, TrayState } from "../types";

export type TrayStatusTag = TrayState | "Exported";

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
