import { describe, expect, it } from "vitest";
import { canExportTrayCsv, countCsvExportableTasks, exportLocalTasksToCsv, isEligibleForCsvExport } from "./csvExport";
import type { LocalTask } from "../types";

function task(overrides: Partial<LocalTask>): LocalTask {
  return {
    id: "task-1",
    project: "STT",
    area: "Bug",
    title: "Fix timer",
    priority: "High",
    issueType: "Bug",
    syncStatus: "Pending",
    descriptionStatus: "Ready",
    language: "Spanish",
    description: "Line one",
    ...overrides
  };
}

describe("CSV export domain helpers", () => {
  it("exports only pending and failed tasks by default", () => {
    expect(isEligibleForCsvExport({ syncStatus: "Pending" })).toBe(true);
    expect(isEligibleForCsvExport({ syncStatus: "Failed" })).toBe(true);
    expect(isEligibleForCsvExport({ syncStatus: "Exported" })).toBe(false);
    expect(isEligibleForCsvExport({ syncStatus: "Created" })).toBe(false);
  });

  it("can include exported tasks when requested", () => {
    const tasks = [
      { syncStatus: "Pending" as const },
      { syncStatus: "Failed" as const },
      { syncStatus: "Exported" as const },
      { syncStatus: "Created" as const }
    ];

    expect(countCsvExportableTasks(tasks)).toBe(2);
    expect(countCsvExportableTasks(tasks, { includeExported: true })).toBe(3);
  });

  it("exports the Jira admin importer fields and keeps created tasks out", () => {
    const csv = exportLocalTasksToCsv([
      task({
        project: " PilotLab ",
        area: "3D",
        title: "Panel, signs and \"metro\" map",
        issueType: "Story",
        description: "Line one\nLine two"
      }),
      task({ id: "task-created", syncStatus: "Created", title: "Already created" })
    ]);

    expect(csv).toBe(
      [
        "Summary,Issue Type,Labels,Description",
        '"Panel, signs and ""metro"" map",Historia,3D,"Line one\nLine two"'
      ].join("\n")
    );
  });

  it("keeps sub-tasks out of CSV exports", () => {
    const csv = exportLocalTasksToCsv([
      task({ id: "parent", title: "Parent task", issueType: "Story" }),
      task({ id: "subtask", title: "Hidden child", issueType: "Sub-task", parentTaskId: "parent" })
    ]);

    expect(csv).toBe(["Summary,Issue Type,Labels,Description", "Parent task,Historia,Bug,Line one"].join("\n"));
    expect(countCsvExportableTasks([{ syncStatus: "Pending", issueType: "Sub-task" }])).toBe(0);
  });

  it("maps local bug issue type to the JTFTEST importer value", () => {
    expect(exportLocalTasksToCsv([task({ issueType: "Bug" })])).toBe(
      ["Summary,Issue Type,Labels,Description", "Fix timer,Error,Bug,Line one"].join("\n")
    );
  });

  it("does not offer CSV export for completed Jira trays", () => {
    expect(
      canExportTrayCsv({
        state: "Completed",
        tasks: [{ syncStatus: "Created" }]
      })
    ).toBe(false);
    expect(
      canExportTrayCsv({
        state: "Active",
        tasks: [{ syncStatus: "Pending" }]
      })
    ).toBe(true);
  });
});
