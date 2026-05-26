import type { LocalTask, SyncStatus, TrayState } from "../types";

export type LocalTaskCsvExportOptions = {
  includeExported?: boolean;
};

const CSV_HEADERS = ["Summary", "Issue Type", "Labels", "Description"] as const;

export function isEligibleForCsvExport(
  task: Pick<LocalTask, "syncStatus">,
  options: LocalTaskCsvExportOptions = {}
): boolean {
  const eligibleStatuses: SyncStatus[] = options.includeExported
    ? ["Pending", "Failed", "Exported"]
    : ["Pending", "Failed"];

  return eligibleStatuses.includes(task.syncStatus);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function issueTypeForCsvImport(issueType: LocalTask["issueType"]): string {
  if (issueType === "Bug") return "Error";
  if (issueType === "Story") return "Historia";
  return issueType;
}

function taskToCsvRow(task: LocalTask): string[] {
  return [
    task.title.trim(),
    issueTypeForCsvImport(task.issueType),
    task.area.trim(),
    task.description ?? ""
  ];
}

export function exportLocalTasksToCsv(
  tasks: LocalTask[],
  options: LocalTaskCsvExportOptions = {}
): string {
  const rows = tasks
    .filter((task) => isEligibleForCsvExport(task, options))
    .map(taskToCsvRow);

  return [CSV_HEADERS, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

export function countCsvExportableTasks(
  tasks: Pick<LocalTask, "syncStatus">[],
  options: LocalTaskCsvExportOptions = {}
): number {
  return tasks.filter((task) => isEligibleForCsvExport(task, options)).length;
}

export function canExportTrayCsv(
  tray: { state: TrayState; tasks: Pick<LocalTask, "syncStatus">[] },
  options: LocalTaskCsvExportOptions = {}
): boolean {
  return tray.state !== "Completed" && countCsvExportableTasks(tray.tasks, options) > 0;
}
