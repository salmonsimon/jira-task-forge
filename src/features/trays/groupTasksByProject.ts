import { isParentTask } from "../../lib/domain";
import type { LocalTask } from "../../lib/types";

export function groupTasksByProject(tasks: LocalTask[]) {
  return tasks.filter(isParentTask).reduce<Record<string, LocalTask[]>>((groups, task) => {
    groups[task.project] ??= [];
    groups[task.project].push(task);
    return groups;
  }, {});
}
