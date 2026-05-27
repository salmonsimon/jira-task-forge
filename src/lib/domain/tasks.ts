import { duplicateTaskForGraph } from "./taskGraph";
import type { IssueType, LocalTask } from "../types";

export function deriveIssueTypeFromArea(area: string): IssueType {
  return area.trim().toLowerCase() === "bug" ? "Bug" : "Story";
}

export function isTaskReadOnly(task: Pick<LocalTask, "syncStatus">): boolean {
  return task.syncStatus === "Created";
}

export function canDeleteTask(task: Pick<LocalTask, "syncStatus">): boolean {
  return !isTaskReadOnly(task);
}

export function canDuplicateTask(task: Pick<LocalTask, "syncStatus">): boolean {
  return !isTaskReadOnly(task);
}

export function duplicateLocalTask(task: LocalTask, nextId: string): LocalTask {
  return duplicateTaskForGraph(task, nextId);
}
