import { describe, expect, it } from "vitest";
import {
  classifyTaskPreflightWarnings,
  classifyTrayPreflightWarnings,
  groupEpicResolutionWarnings
} from "./preflight";
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

  it("does not require descriptions or direct epic mappings for sub-tasks", () => {
    const warnings = classifyTaskPreflightWarnings(
      task({
        issueType: "Sub-task",
        descriptionStatus: "Missing",
        epic: undefined,
        parentTaskId: "parent-1"
      })
    );

    expect(warnings).toEqual([]);
  });

  it("blocks sub-tasks without a usable parent", () => {
    const warnings = classifyTrayPreflightWarnings([
      task({ id: "parent-1", syncStatus: "Created", jiraKey: undefined }),
      task({ id: "subtask-1", issueType: "Sub-task", parentTaskId: "parent-1" })
    ]);

    expect(warnings).toContainEqual({
      code: "missing-parent-task",
      severity: "blocking",
      taskId: "subtask-1",
      message: "Sub-task parent is marked Created but has no Jira key to attach to."
    });
  });

  it("groups missing epic warnings by target with compact task title lists", () => {
    const tasks = [
      task({ id: "task-1", project: "STT", area: "3D", title: "Model vending machine", epic: undefined }),
      task({ id: "task-2", project: "STT", area: "3D", title: "Model ticket machine", epic: undefined }),
      task({ id: "task-3", project: "PilotLab", area: "Bug", title: "Fix onboarding", epic: undefined })
    ];
    const warnings = classifyTrayPreflightWarnings(tasks).filter((warning) => warning.code === "missing-epic");

    expect(groupEpicResolutionWarnings(warnings, tasks)).toEqual([
      {
        target: "[STT] 3D",
        taskTitles: ["Model vending machine", "Model ticket machine"],
        warnings: [warnings[0], warnings[1]]
      },
      {
        target: "[PilotLab] Bug",
        taskTitles: ["Fix onboarding"],
        warnings: [warnings[2]]
      }
    ]);
  });

  it("keeps parent missing descriptions reviewable without turning sub-tasks into blockers", () => {
    const warnings = classifyTrayPreflightWarnings([
      task({
        id: "blocked-parent",
        title: " ",
        descriptionStatus: "Missing"
      }),
      task({
        id: "review-parent",
        descriptionStatus: "Missing"
      }),
      task({
        id: "subtask-1",
        issueType: "Sub-task",
        parentTaskId: "review-parent",
        descriptionStatus: "Missing",
        epic: undefined
      })
    ]);

    expect(warnings.filter((warning) => warning.severity === "blocking")).toEqual([
      {
        code: "missing-title",
        severity: "blocking",
        taskId: "blocked-parent",
        message: "Title is required before creating this task in Jira."
      }
    ]);
    expect(warnings.filter((warning) => warning.code === "missing-description")).toEqual([
      {
        code: "missing-description",
        severity: "resolvable",
        taskId: "blocked-parent",
        message: "Description is missing and can be reviewed before Jira creation."
      },
      {
        code: "missing-description",
        severity: "resolvable",
        taskId: "review-parent",
        message: "Description is missing and can be reviewed before Jira creation."
      }
    ]);
    expect(warnings.some((warning) => warning.taskId === "subtask-1")).toBe(false);
  });
});
