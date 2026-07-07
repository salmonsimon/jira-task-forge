import type { AppSettings, Category } from "./types";

export function isNotionSyncedProjectReadOnly(
  category: Category,
  catalogSourceMode: AppSettings["catalogSourceMode"]
): boolean {
  return category.categoryType === "project" && catalogSourceMode === "notion" && category.source !== "local";
}
