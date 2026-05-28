import { isParentTask, orderProjectNames } from "../../lib/domain";
import type { LocalTask } from "../../lib/types";

export function groupTasksByProject(tasks: LocalTask[]) {
  const groups = tasks.filter(isParentTask).reduce<Record<string, LocalTask[]>>((groups, task) => {
    groups[task.project] ??= [];
    groups[task.project].push(task);
    return groups;
  }, {});

  return Object.fromEntries(orderProjectNames(Object.keys(groups)).map((project) => [project, groups[project]]));
}
