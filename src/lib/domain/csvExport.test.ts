import { describe, expect, it } from "vitest";
import { countCsvExportableTasks, exportLocalTasksToCsv, isEligibleForCsvExport } from "./csvExport";
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

  it("escapes CSV cells and keeps created tasks out", () => {
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
        "Project,Summary,Issue Type,Priority,Labels,Description",
        'PilotLab,"Panel, signs and ""metro"" map",Story,High,3D,"Line one\nLine two"'
      ].join("\n")
    );
  });
});
