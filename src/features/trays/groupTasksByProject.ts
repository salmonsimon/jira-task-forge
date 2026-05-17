import type { LocalTask } from "../../lib/types";

export function groupTasksByProject(tasks: LocalTask[]) {
  return tasks.reduce<Record<string, LocalTask[]>>((groups, task) => {
    groups[task.project] ??= [];
    groups[task.project].push(task);
    return groups;
  }, {});
}
