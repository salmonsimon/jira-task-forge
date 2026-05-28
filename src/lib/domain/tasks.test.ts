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

  it("allows delete and duplicate only while tasks remain local-first", () => {
    expect([
      ["Pending", canDeleteTask({ syncStatus: "Pending" }), canDuplicateTask({ syncStatus: "Pending" })],
      ["Failed", canDeleteTask({ syncStatus: "Failed" }), canDuplicateTask({ syncStatus: "Failed" })],
      ["Exported", canDeleteTask({ syncStatus: "Exported" }), canDuplicateTask({ syncStatus: "Exported" })],
      ["Created", canDeleteTask({ syncStatus: "Created" }), canDuplicateTask({ syncStatus: "Created" })]
    ]).toEqual([
      ["Pending", true, true],
      ["Failed", true, true],
      ["Exported", true, true],
      ["Created", false, false]
    ]);
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
    expect(duplicate.attachments).toEqual(baseTask.attachments);
    expect(duplicate.attachments).not.toBe(baseTask.attachments);
  });

  it("duplicates Jira-linked tasks as fresh local drafts without remote audit identity", () => {
    const duplicate = duplicateLocalTask(
      {
        ...baseTask,
        syncStatus: "Created",
        jiraKey: "JTFTEST-12",
        jiraUrl: "https://example.atlassian.net/browse/JTFTEST-12",
        syncLog: [
          {
            id: "log-1",
            timestamp: "2026-05-28T10:00:00.000Z",
            event: "created",
            detail: "Created JTFTEST-12"
          }
        ]
      },
      "task-copy"
    );

    expect(duplicate).toMatchObject({
      id: "task-copy",
      syncStatus: "Pending"
    });
    expect(duplicate.jiraKey).toBeUndefined();
    expect(duplicate.jiraUrl).toBeUndefined();
    expect(duplicate.syncLog).toBeUndefined();
  });
});
