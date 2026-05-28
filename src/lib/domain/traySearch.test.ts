import { describe, expect, it } from "vitest";
import { filterParentTasksByTraySearch } from "./traySearch";
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
    ...overrides
  };
}

describe("tray search helpers", () => {
  it("filters only parent tasks while preserving tray order", () => {
    const tasks = [
      task({ id: "parent-1", title: "Fix timer", jiraKey: "DTS-101" }),
      task({ id: "parent-2", project: "PilotLab", area: "3D", title: "Model machine" }),
      task({
        id: "child-1",
        issueType: "Sub-task",
        parentTaskId: "parent-2",
        title: "Collect metro references"
      }),
      task({
        id: "parent-3",
        project: "MR Studio",
        area: "Polish",
        title: "Tune menu",
        description: "Adjust hover feedback."
      })
    ];

    expect(filterParentTasksByTraySearch(tasks, "stt").map((candidate) => candidate.id)).toEqual(["parent-1"]);
    expect(filterParentTasksByTraySearch(tasks, "metro").map((candidate) => candidate.id)).toEqual(["parent-2"]);
    expect(filterParentTasksByTraySearch(tasks, "hover feedback").map((candidate) => candidate.id)).toEqual(["parent-3"]);
    expect(filterParentTasksByTraySearch(tasks, "DTS-101").map((candidate) => candidate.id)).toEqual(["parent-1"]);
  });

  it("returns parent tasks in their original order for a blank query", () => {
    const tasks = [
      task({ id: "parent-1", title: "First" }),
      task({ id: "child-1", issueType: "Sub-task", parentTaskId: "parent-1", title: "Child" }),
      task({ id: "parent-2", title: "Second" })
    ];

    expect(filterParentTasksByTraySearch(tasks, "  ").map((candidate) => candidate.id)).toEqual([
      "parent-1",
      "parent-2"
    ]);
  });
});
