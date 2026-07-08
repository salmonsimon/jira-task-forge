import type { AppSettings, Category } from "../types";

export function isTransversalProject(project: Pick<Category, "categoryType" | "name">): boolean {
  return project.categoryType === "project" && project.name.trim().toLowerCase() === "transversal";
}

export function visibleProjectsForMode(projects: Category[], projectSyncEnabled: boolean): Category[] {
  if (projectSyncEnabled) return projects;
  return projects.filter((project) => project.source === "local" || isTransversalProject(project));
}

export function visibleAreasForMode(areas: Category[], catalogSourceMode: AppSettings["catalogSourceMode"]): Category[] {
  const expectedSource = catalogSourceMode === "manual" ? "local" : "catalog";
  return areas.filter((area) => area.source === expectedSource);
}
