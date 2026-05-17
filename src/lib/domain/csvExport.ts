import type { LocalTask, SyncStatus } from "../types";

export type LocalTaskCsvExportOptions = {
  includeExported?: boolean;
};

const CSV_HEADERS = ["Project", "Summary", "Issue Type", "Priority", "Labels", "Description"] as const;

function isEligibleForCsvExport(
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

function taskToCsvRow(task: LocalTask): string[] {
  return [
    task.project.trim(),
    task.title.trim(),
    task.issueType,
    task.priority,
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
