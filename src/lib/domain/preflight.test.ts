import { describe, expect, it } from "vitest";
import { classifyTaskPreflightWarnings, classifyTrayPreflightWarnings } from "./preflight";
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
    epic: "DTS-1",
    ...overrides
  };
}

describe("preflight domain helpers", () => {
  it("classifies missing task fields as blocking warnings", () => {
    const warnings = classifyTaskPreflightWarnings(
      task({ project: " ", area: "", title: " ", descriptionStatus: "Ready" })
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      "missing-project",
      "missing-area",
      "missing-title"
    ]);
    expect(warnings.every((warning) => warning.severity === "blocking")).toBe(true);
  });

  it("classifies missing description, epic, and failed retry as resolvable", () => {
    const warnings = classifyTaskPreflightWarnings(
      task({ descriptionStatus: "Missing", epic: undefined, syncStatus: "Failed" })
    );

    expect(warnings.map((warning) => warning.code)).toEqual([
      "missing-description",
      "missing-epic",
      "retry-failed-task"
    ]);
    expect(warnings.every((warning) => warning.severity === "resolvable")).toBe(true);
  });

  it("ignores created tasks and flags empty trays", () => {
    const warnings = classifyTrayPreflightWarnings([task({ syncStatus: "Created" })]);

    expect(warnings).toEqual([
      {
        code: "empty-tray",
        severity: "blocking",
        message: "There are no pending, failed, or exported tasks to create in Jira."
      }
    ]);
  });

  it("flags exported tasks as duplicate risk", () => {
    const warnings = classifyTrayPreflightWarnings([task({ syncStatus: "Exported" })]);

    expect(warnings.some((warning) => warning.code === "exported-duplicate-risk")).toBe(true);
  });
});
