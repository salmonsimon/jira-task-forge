export function formatBackupTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

export function getVisibleBackupCounts(counts?: Record<string, number>) {
  if (!counts) return [];
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ label: formatBackupCountLabel(key, count), count }));
}

export function formatBackupCountLabel(key: string, count: number) {
  const labels: Record<string, [string, string]> = {
    trays: ["tray", "trays"],
    tasks: ["task", "tasks"],
    categories: ["category", "categories"],
    epicMappings: ["epic mapping", "epic mappings"],
    jqlFavorites: ["JQL favorite", "JQL favorites"],
    settings: ["setting", "settings"],
    attachmentMetadata: ["attachment metadata", "attachment metadata"],
    attachmentVariants: ["attachment variant", "attachment variants"],
    auditSummaries: ["audit summary", "audit summaries"]
  };
  const [singular, plural] = labels[key] ?? [key, key];
  return count === 1 ? singular : plural;
}
