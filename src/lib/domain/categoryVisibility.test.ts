import { describe, expect, it } from "vitest";
import type { Category } from "../types";
import { visibleAreasForMode, visibleProjectsForMode } from "./categoryVisibility";

const localProject: Category = { id: "p-local", categoryType: "project", name: "Manual", source: "local" };
const syncedProject: Category = { id: "p-jira", categoryType: "project", name: "Synced", source: "jira" };
const localArea: Category = { id: "a-local", categoryType: "area", name: "Manual Area", source: "local" };
const syncedArea: Category = { id: "a-catalog", categoryType: "area", name: "Catalog Area", source: "catalog" };

describe("category visibility by mode", () => {
  it("keeps local Projects visible in sync mode and hides Jira Projects in manual mode", () => {
    expect(visibleProjectsForMode([localProject, syncedProject], true)).toEqual([localProject, syncedProject]);
    expect(visibleProjectsForMode([localProject, syncedProject], false)).toEqual([localProject]);
  });

  it("separates manual and synced Areas by catalog mode", () => {
    expect(visibleAreasForMode([localArea, syncedArea], "manual")).toEqual([localArea]);
    expect(visibleAreasForMode([localArea, syncedArea], "notion")).toEqual([syncedArea]);
    expect(visibleAreasForMode([localArea, syncedArea], "public-exportable")).toEqual([syncedArea]);
  });
});
