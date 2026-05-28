import type { LocalTask } from "../types";
import { isParentTask, isSubtask } from "./taskGraph";

export function filterParentTasksByTraySearch(tasks: LocalTask[], query: string): LocalTask[] {
  const normalizedQuery = normalizeSearchText(query);
  const parentTasks = tasks.filter(isParentTask);
  if (!normalizedQuery) return parentTasks;

  const subtasksByParentId = groupSubtasksByParentId(tasks);
  return parentTasks.filter((task) => {
    if (taskMatchesTraySearch(task, normalizedQuery)) return true;

    return (subtasksByParentId.get(task.id) ?? []).some((subtask) =>
      normalizeSearchText(subtask.title).includes(normalizedQuery)
    );
  });
}

function groupSubtasksByParentId(tasks: LocalTask[]): Map<string, LocalTask[]> {
  const subtasksByParentId = new Map<string, LocalTask[]>();
  for (const task of tasks) {
    if (!isSubtask(task) || !task.parentTaskId) continue;

    const subtasks = subtasksByParentId.get(task.parentTaskId) ?? [];
    subtasks.push(task);
    subtasksByParentId.set(task.parentTaskId, subtasks);
  }
  return subtasksByParentId;
}

function taskMatchesTraySearch(task: LocalTask, normalizedQuery: string): boolean {
  return [
    task.title,
    task.project,
    task.area,
    task.description,
    task.jiraKey
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}
