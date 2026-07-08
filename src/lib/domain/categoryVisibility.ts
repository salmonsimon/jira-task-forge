import type { AppSettings, Category } from "../types";

export function visibleProjectsForMode(projects: Category[], projectSyncEnabled: boolean): Category[] {
  if (projectSyncEnabled) return projects;
  return projects.filter((project) => project.source === "local");
}

export function visibleAreasForMode(areas: Category[], catalogSourceMode: AppSettings["catalogSourceMode"]): Category[] {
  const expectedSource = catalogSourceMode === "manual" ? "local" : "catalog";
  return areas.filter((area) => area.source === expectedSource);
}
