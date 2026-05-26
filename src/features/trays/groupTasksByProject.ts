import type { LocalTask } from "../../lib/types";

export function groupTasksByProject(tasks: LocalTask[]) {
  return tasks.filter(isVisibleTrayTask).reduce<Record<string, LocalTask[]>>((groups, task) => {
    groups[task.project] ??= [];
    groups[task.project].push(task);
    return groups;
  }, {});
}

function isVisibleTrayTask(task: LocalTask) {
  return task.issueType !== "Sub-task" && !task.parentTaskId;
}
