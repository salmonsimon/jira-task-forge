import type { LocalTask, PreflightWarning } from "../types";

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
  }

  if (!task.title.trim()) {
    warnings.push({
      code: "missing-title",
      severity: "blocking",
      taskId: task.id,
      message: "Title is required before creating this task in Jira."
    });
  }

  if (task.issueType === "Sub-task" && !task.parentTaskId) {
    warnings.push({
      code: "missing-parent-task",
      severity: "blocking",
      taskId: task.id,
      message: "Sub-task is missing its parent local task."
    });
  }

  if (task.issueType !== "Sub-task" && task.descriptionStatus === "Missing") {
    warnings.push({
      code: "missing-description",
      severity: "resolvable",
      taskId: task.id,
      message: "Description is missing and can be reviewed before Jira creation."
    });
  }

  if (task.issueType !== "Sub-task" && !task.epic) {
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
    if (task.issueType === "Sub-task" && task.parentTaskId) {
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
