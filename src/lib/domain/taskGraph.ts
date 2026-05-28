import type { LocalTask } from "../types";

export const default3dSubtaskTitles = [
  "Recolectar referencias",
  "Definir escala y restricciones",
  "Modelar base del asset",
  "Texturizar",
  "Revisar en contexto"
];

export type TaskGraphSubtaskGroup<TTask extends Pick<LocalTask, "id" | "parentTaskId">> = {
  parentTask: TTask | undefined;
  subtasks: TTask[];
};

export function isSubtask(task: Pick<LocalTask, "issueType" | "parentTaskId">): boolean {
  return task.issueType === "Sub-task" || Boolean(task.parentTaskId);
}

export function isParentTask(task: Pick<LocalTask, "issueType" | "parentTaskId">): boolean {
  return !isSubtask(task);
}

export function getDefaultSubtaskTitles(task: Pick<LocalTask, "area" | "issueType" | "parentTaskId">): string[] {
  if (isSubtask(task)) return [];
  return task.area.trim().toLowerCase() === "3d" ? [...default3dSubtaskTitles] : [];
}

export function dedupeSubtaskTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const normalizedTitles: string[] = [];
  for (const title of titles) {
    const normalizedTitle = title.trim();
    const key = normalizedTitle.toLowerCase();
    if (!normalizedTitle || seen.has(key)) continue;
    seen.add(key);
    normalizedTitles.push(normalizedTitle);
  }
  return normalizedTitles;
}

export function getChildTasks<TTask extends Pick<LocalTask, "parentTaskId">>(tasks: TTask[], parentTaskId: string): TTask[] {
  return tasks.filter((task) => task.parentTaskId === parentTaskId);
}

export function hasChildTaskTitle(
  tasks: Pick<LocalTask, "parentTaskId" | "title">[],
  parentTaskId: string,
  title: string
): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  return tasks.some(
    (task) => task.parentTaskId === parentTaskId && task.title.trim().toLowerCase() === normalizedTitle
  );
}

export function buildDraftSubtask(parentTask: LocalTask, title: string, id: string): LocalTask {
  return {
    id,
    project: parentTask.project,
    area: parentTask.area,
    title,
    priority: parentTask.priority,
    issueType: "Sub-task",
    syncStatus: "Pending",
    descriptionStatus: "Ready",
    language: parentTask.language,
    parentTaskId: parentTask.id
  };
}

export function duplicateTaskForGraph(task: LocalTask, nextId: string): LocalTask {
  const isChildTask = isSubtask(task);
  return {
    id: nextId,
    project: task.project,
    area: task.area,
    title: `${task.title} (copy)`,
    priority: task.priority,
    issueType: isChildTask ? "Sub-task" : deriveIssueTypeFromAreaForGraph(task.area),
    syncStatus: "Pending",
    descriptionStatus: task.descriptionStatus,
    language: task.language,
    epic: isChildTask ? undefined : task.epic,
    parentTaskId: isChildTask ? task.parentTaskId : undefined,
    description: task.description,
    notes: task.notes,
    attachments: task.attachments?.map((attachment) => ({ ...attachment }))
  };
}

function deriveIssueTypeFromAreaForGraph(area: string): LocalTask["issueType"] {
  return area.trim().toLowerCase() === "bug" ? "Bug" : "Story";
}

export function taskGraphDeleteIds(tasks: Pick<LocalTask, "id" | "parentTaskId">[], taskId: string): Set<string> {
  return new Set([taskId, ...getChildTasks(tasks, taskId).map((task) => task.id)]);
}

export function removeTaskGraph(tasks: LocalTask[], taskId: string): LocalTask[] {
  const deletedIds = taskGraphDeleteIds(tasks, taskId);
  return tasks.filter((task) => !deletedIds.has(task.id));
}

export function insertChildrenAfterExistingChildren(
  tasks: LocalTask[],
  parentTaskId: string,
  childTasks: LocalTask[]
): LocalTask[] {
  if (!childTasks.length) return tasks;
  const parentIndex = tasks.findIndex((task) => task.id === parentTaskId);
  if (parentIndex === -1) return tasks;

  const nextTasks = [...tasks];
  let insertIndex = parentIndex + 1;
  while (nextTasks[insertIndex]?.parentTaskId === parentTaskId) insertIndex += 1;
  nextTasks.splice(insertIndex, 0, ...childTasks);
  return nextTasks;
}

export function groupSubtasksByParent<TTask extends Pick<LocalTask, "id" | "parentTaskId" | "issueType">>(
  tasks: TTask[],
  parentCandidates: TTask[] = tasks
): TaskGraphSubtaskGroup<TTask>[] {
  const tasksById = new Map(parentCandidates.map((task) => [task.id, task]));
  return tasks.filter(isSubtask).reduce<TaskGraphSubtaskGroup<TTask>[]>((groups, subtask) => {
    const parentTask = subtask.parentTaskId ? tasksById.get(subtask.parentTaskId) : undefined;
    const existingGroup = groups.find((group) => group.parentTask?.id === parentTask?.id);
    if (existingGroup) {
      existingGroup.subtasks.push(subtask);
      return groups;
    }

    groups.push({ parentTask, subtasks: [subtask] });
    return groups;
  }, []);
}
