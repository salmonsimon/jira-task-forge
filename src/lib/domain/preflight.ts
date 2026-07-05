import { resolveCatalogArea } from "./catalog";
import { isSubtask } from "./taskGraph";
import type { LocalTask, PreflightWarning } from "../types";

export type EpicResolutionWarningGroup = {
  target: string;
  taskTitles: string[];
  warnings: PreflightWarning[];
};

export function classifyTaskPreflightWarnings(task: LocalTask): PreflightWarning[] {
  const warnings: PreflightWarning[] = [];

  if (!task.project.trim()) {
    warnings.push({
      code: "missing-project",
      severity: "blocking",
      taskId: task.id,
      message: "Project is required before creating this task in Jira."
    });
  }

  if (!task.area.trim()) {
    warnings.push({
      code: "missing-area",
      severity: "blocking",
      taskId: task.id,
      message: "Area is required before creating this task in Jira."
    });
  } else if (resolveCatalogArea(task.area).kind === "blocked") {
    warnings.push({
      code: "invalid-area",
      severity: "blocking",
      taskId: task.id,
      message: "Choose an official catalog area before creating this task in Jira."
    });
  }

  if (!task.title.trim()) {
    warnings.push({
      code: "missing-title",
      severity: "blocking",
      taskId: task.id,
      message: "Title is required before creating this task in Jira."
    });
  }

  if (isSubtask(task) && !task.parentTaskId) {
    warnings.push({
      code: "missing-parent-task",
      severity: "blocking",
      taskId: task.id,
      message: "Sub-task is missing its parent local task."
    });
  }

  if (!isSubtask(task) && task.descriptionStatus === "Missing") {
    warnings.push({
      code: "missing-description",
      severity: "resolvable",
      taskId: task.id,
      message: "Description is missing and can be reviewed before Jira creation."
    });
  }

  if (!isSubtask(task) && !task.epic) {
    warnings.push({
      code: "missing-epic",
      severity: "resolvable",
      taskId: task.id,
      message: "Epic mapping is missing and can be resolved during preflight."
    });
  }

  if (task.syncStatus === "Failed") {
    warnings.push({
      code: "retry-failed-task",
      severity: "resolvable",
      taskId: task.id,
      message: "This failed task will be retried."
    });
  }

  return warnings;
}

export function formatEpicTarget(project: string, area: string): string {
  return `[${project.trim()}] ${area.trim()}`;
}

export function groupEpicResolutionWarnings(
  warnings: PreflightWarning[],
  tasks: LocalTask[]
): EpicResolutionWarningGroup[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const groups = new Map<string, EpicResolutionWarningGroup>();

  for (const warning of warnings) {
    if (warning.code !== "missing-epic") continue;

    const task = warning.taskId ? tasksById.get(warning.taskId) : undefined;
    const target = task && task.project.trim() && task.area.trim()
      ? formatEpicTarget(task.project, task.area)
      : "Unresolved epic target";
    const group = groups.get(target) ?? {
      target,
      taskTitles: [],
      warnings: []
    };

    group.warnings.push(warning);
    if (task) group.taskTitles.push(task.title.trim() || "Untitled task");
    groups.set(target, group);
  }

  return Array.from(groups.values());
}

export function classifyTrayPreflightWarnings(tasks: LocalTask[]): PreflightWarning[] {
  const createableTasks = tasks.filter((task) => task.syncStatus !== "Created");
  const warnings = createableTasks.flatMap(classifyTaskPreflightWarnings);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  if (createableTasks.length === 0) {
    warnings.push({
      code: "empty-tray",
      severity: "blocking",
      message: "There are no pending, failed, or exported tasks to create in Jira."
    });
  }

  for (const task of createableTasks) {
    if (isSubtask(task) && task.parentTaskId) {
      const parentTask = tasksById.get(task.parentTaskId);
      if (!parentTask) {
        warnings.push({
          code: "missing-parent-task",
          severity: "blocking",
          taskId: task.id,
          message: "Sub-task parent is no longer in this tray."
        });
      } else if (parentTask.syncStatus === "Created" && !parentTask.jiraKey) {
        warnings.push({
          code: "missing-parent-task",
          severity: "blocking",
          taskId: task.id,
          message: "Sub-task parent is marked Created but has no Jira key to attach to."
        });
      }
    }

    if (task.syncStatus === "Exported") {
      warnings.push({
        code: "exported-duplicate-risk",
        severity: "resolvable",
        taskId: task.id,
        message: "This task was exported to CSV. Confirm it was not already imported into Jira before creating it through the API."
      });
    }
  }

  return warnings;
}
