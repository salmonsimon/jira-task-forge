import { describe, expect, it } from "vitest";
import type { Category } from "../types";
import { visibleAreasForMode, visibleProjectsForMode } from "./categoryVisibility";

const localProject: Category = { id: "p-local", categoryType: "project", name: "Manual", source: "local" };
const syncedProject: Category = { id: "p-jira", categoryType: "project", name: "Synced", source: "jira" };
const transversalProject: Category = { id: "p-transversal", categoryType: "project", name: "Transversal", source: "jira" };
const localArea: Category = { id: "a-local", categoryType: "area", name: "Manual Area", source: "local" };
const syncedArea: Category = { id: "a-catalog", categoryType: "area", name: "Catalog Area", source: "catalog" };

describe("category visibility by mode", () => {
  it("keeps local Projects visible in sync mode and hides non-Transversal Jira Projects in manual mode", () => {
    expect(visibleProjectsForMode([localProject, syncedProject, transversalProject], true)).toEqual([
      localProject,
      syncedProject,
      transversalProject
    ]);
    expect(visibleProjectsForMode([localProject, syncedProject, transversalProject], false)).toEqual([
      localProject,
      transversalProject
    ]);
  });

  it("separates manual and synced Areas by catalog mode", () => {
    expect(visibleAreasForMode([localArea, syncedArea], "manual")).toEqual([localArea]);
    expect(visibleAreasForMode([localArea, syncedArea], "notion")).toEqual([syncedArea]);
    expect(visibleAreasForMode([localArea, syncedArea], "public-exportable")).toEqual([syncedArea]);
  });
});
