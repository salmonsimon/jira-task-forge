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
  return {
    id: nextId,
    project: task.project,
    area: task.area,
    title: `${task.title} (copy)`,
    priority: task.priority,
    issueType: deriveIssueTypeFromArea(task.area),
    syncStatus: "Pending",
    descriptionStatus: task.descriptionStatus,
    language: task.language,
    epic: task.epic,
    description: task.description,
    notes: task.notes,
    subtasks: task.subtasks ? [...task.subtasks] : undefined,
    attachments: task.attachments?.map((attachment) => ({ ...attachment }))
  };
}
