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

  if (task.descriptionStatus === "Missing") {
    warnings.push({
      code: "missing-description",
      severity: "resolvable",
      taskId: task.id,
      message: "Description is missing and can be reviewed before Jira creation."
    });
  }

  if (!task.epic) {
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
  return tasks.flatMap(classifyTaskPreflightWarnings);
}
