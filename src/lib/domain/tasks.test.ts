import { describe, expect, it } from "vitest";
import { canDeleteTask, canDuplicateTask, deriveIssueTypeFromArea, duplicateLocalTask, isTaskReadOnly } from "./tasks";
import type { LocalTask } from "../types";

const baseTask: LocalTask = {
  id: "task-1",
  project: "STT",
  area: "3D",
  title: "Model vending machine",
  priority: "High",
  issueType: "Story",
  syncStatus: "Failed",
  descriptionStatus: "Draft",
  language: "Spanish",
  epic: "DTS-1",
  description: "Description",
  notes: "Notes",
  subtasks: ["Reference pass"],
  attachments: [{ id: "att-1", filename: "reference.png", purpose: "AI + Jira attachment", size: "42 KB" }]
};

describe("task domain helpers", () => {
  it("derives bug issue type only from the Bug area", () => {
    expect(deriveIssueTypeFromArea("Bug")).toBe("Bug");
    expect(deriveIssueTypeFromArea("  bug  ")).toBe("Bug");
    expect(deriveIssueTypeFromArea("3D")).toBe("Story");
    expect(deriveIssueTypeFromArea("")).toBe("Story");
  });

  it("treats created tasks as read-only", () => {
    expect(isTaskReadOnly({ syncStatus: "Created" })).toBe(true);
    expect(canDeleteTask({ syncStatus: "Created" })).toBe(false);
    expect(canDuplicateTask({ syncStatus: "Created" })).toBe(false);
    expect(canDeleteTask({ syncStatus: "Failed" })).toBe(true);
    expect(canDuplicateTask({ syncStatus: "Pending" })).toBe(true);
  });

  it("duplicates editable task content without copying sync identity", () => {
    const duplicate = duplicateLocalTask(baseTask, "task-copy");

    expect(duplicate).toMatchObject({
      id: "task-copy",
      project: "STT",
      area: "3D",
      title: "Model vending machine (copy)",
      priority: "High",
      issueType: "Story",
      syncStatus: "Pending",
      descriptionStatus: "Draft",
      language: "Spanish",
      epic: "DTS-1",
      description: "Description",
      notes: "Notes"
    });
    expect(duplicate.subtasks).toEqual(["Reference pass"]);
    expect(duplicate.attachments).toEqual(baseTask.attachments);
    expect(duplicate.attachments).not.toBe(baseTask.attachments);
  });
});
