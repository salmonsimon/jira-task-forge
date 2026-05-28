import { describe, expect, it } from "vitest";
import type { LocalTask } from "../types";
import {
  addLocalIssueRelationship,
  countIssueRelationships,
  findIssueRelationshipTarget,
  formatIssueRelationshipTargetLabel,
  formatIssueRelationshipTypeLabel,
  getAvailableIssueRelationshipTargets,
  removeLocalIssueRelationship
} from "./issueRelationships";

const baseTask: LocalTask = {
  id: "task-source",
  project: "STT",
  area: "Programacion",
  title: "Persistir avance local",
  priority: "High",
  issueType: "Story",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish"
};

const targetTask: LocalTask = {
  id: "task-target",
  project: "STT",
  area: "Bug",
  title: "Resolver problema timer",
  priority: "Highest",
  issueType: "Bug",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish"
};

describe("issue relationships", () => {
  it("labels Jira relationship directions", () => {
    expect(formatIssueRelationshipTypeLabel("blocks")).toBe("Blocks");
    expect(formatIssueRelationshipTypeLabel("blocked_by")).toBe("Blocked by");
  });

  it("offers other local tasks as relationship targets", () => {
    expect(getAvailableIssueRelationshipTargets([baseTask, targetTask], baseTask.id)).toEqual([targetTask]);
  });

  it("keeps relationship helpers safe when tray tasks have not loaded", () => {
    const relationships = addLocalIssueRelationship(baseTask, "blocks", targetTask.id);

    expect(getAvailableIssueRelationshipTargets(undefined, baseTask.id)).toEqual([]);
    expect(findIssueRelationshipTarget(undefined, relationships[0])).toBeNull();
  });

  it("adds a deterministic local relationship without duplicating it", () => {
    const relationships = addLocalIssueRelationship(baseTask, "blocks", targetTask.id);
    const duplicateAttempt = addLocalIssueRelationship({ ...baseTask, issueRelationships: relationships }, "blocks", targetTask.id);

    expect(relationships).toEqual([
      {
        id: "rel-task-source-blocks-task-target",
        type: "blocks",
        targetTaskId: targetTask.id
      }
    ]);
    expect(duplicateAttempt).toBe(relationships);
  });

  it("does not let a task link to itself", () => {
    expect(addLocalIssueRelationship(baseTask, "blocked_by", baseTask.id)).toEqual([]);
  });

  it("finds, labels, counts, and removes relationships", () => {
    const relationships = addLocalIssueRelationship(baseTask, "blocked_by", targetTask.id);
    const taskWithRelationship = { ...baseTask, issueRelationships: relationships };

    expect(countIssueRelationships(taskWithRelationship)).toBe(1);
    expect(findIssueRelationshipTarget([baseTask, targetTask], relationships[0])).toBe(targetTask);
    expect(formatIssueRelationshipTargetLabel(targetTask)).toBe("[STT] Bug · Resolver problema timer");
    expect(removeLocalIssueRelationship(relationships, relationships[0].id)).toEqual([]);
  });
});
