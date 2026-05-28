import { describe, expect, it } from "vitest";
import type { LocalTask } from "../../lib/types";
import { groupTasksByProject } from "./groupTasksByProject";

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

describe("groupTasksByProject", () => {
  it("pins Transversal first and keeps other project groups in first-seen order", () => {
    const grouped = groupTasksByProject([
      task({ id: "task-1", project: "STT" }),
      task({ id: "task-2", project: "PilotLab" }),
      task({ id: "task-3", project: "Transversal" }),
      task({ id: "task-4", project: "MR Studio" })
    ]);

    expect(Object.keys(grouped)).toEqual(["Transversal", "STT", "PilotLab", "MR Studio"]);
  });

  it("omits sub-tasks from project groups", () => {
    const grouped = groupTasksByProject([
      task({ id: "task-1", project: "STT" }),
      task({ id: "task-2", project: "Transversal", issueType: "Sub-task", parentTaskId: "task-1" })
    ]);

    expect(Object.keys(grouped)).toEqual(["STT"]);
  });
});
