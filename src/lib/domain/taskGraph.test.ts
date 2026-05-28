import { describe, expect, it } from "vitest";
import {
  buildDraftSubtask,
  dedupeSubtaskTitles,
  duplicateTaskForGraph,
  getDefaultSubtaskTitles,
  groupSubtasksByParent,
  insertChildrenAfterExistingChildren,
  isParentTask,
  isSubtask,
  removeTaskGraph,
  taskGraphDeleteIds
} from "./taskGraph";
import type { LocalTask } from "../types";

const parentTask: LocalTask = {
  id: "parent-1",
  project: "STT",
  area: "3D",
  title: "Model vending machine",
  priority: "High",
  issueType: "Story",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish",
  epic: "JTFTEST-1"
};

const childTask: LocalTask = {
  id: "child-1",
  project: "STT",
  area: "3D",
  title: "Recolectar referencias",
  priority: "High",
  issueType: "Sub-task",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish",
  parentTaskId: parentTask.id
};

describe("Local Task graph helpers", () => {
  it("detects parent and child Local Tasks from one interface", () => {
    expect(isParentTask(parentTask)).toBe(true);
    expect(isSubtask(parentTask)).toBe(false);
    expect(isParentTask(childTask)).toBe(false);
    expect(isSubtask(childTask)).toBe(true);
  });

  it("owns hardcoded 3D default sub-task titles and title dedupe", () => {
    expect(getDefaultSubtaskTitles(parentTask)).toEqual([
      "Recolectar referencias",
      "Definir escala y restricciones",
      "Modelar base del asset",
      "Texturizar",
      "Revisar en contexto"
    ]);
    expect(getDefaultSubtaskTitles(childTask)).toEqual([]);
    expect(dedupeSubtaskTitles([" Texturizar ", "texturizar", "", "Revisar"])).toEqual([
      "Texturizar",
      "Revisar"
    ]);
  });

  it("builds child Local Tasks from the parent graph invariant", () => {
    expect(buildDraftSubtask(parentTask, "Texturizar", "child-2")).toMatchObject({
      id: "child-2",
      project: parentTask.project,
      area: parentTask.area,
      priority: parentTask.priority,
      issueType: "Sub-task",
      syncStatus: "Pending",
      descriptionStatus: "Ready",
      parentTaskId: parentTask.id
    });
  });

  it("duplicates parents and children without copying Jira identity", () => {
    const parentDuplicate = duplicateTaskForGraph(
      { ...parentTask, syncStatus: "Failed", jiraKey: "JTFTEST-2", jiraUrl: "https://example.test" },
      "parent-copy"
    );
    const childDuplicate = duplicateTaskForGraph(
      { ...childTask, syncStatus: "Failed", jiraKey: "JTFTEST-3", jiraUrl: "https://example.test" },
      "child-copy"
    );

    expect(parentDuplicate).toMatchObject({
      id: "parent-copy",
      issueType: "Story",
      syncStatus: "Pending",
      parentTaskId: undefined,
      epic: "JTFTEST-1"
    });
    expect(parentDuplicate.jiraKey).toBeUndefined();
    expect(childDuplicate).toMatchObject({
      id: "child-copy",
      issueType: "Sub-task",
      syncStatus: "Pending",
      parentTaskId: parentTask.id,
      epic: undefined
    });
    expect(childDuplicate.jiraKey).toBeUndefined();
  });

  it("removes parent task graphs and inserts new children after existing children", () => {
    const sibling: LocalTask = { ...parentTask, id: "sibling", title: "Sibling" };
    const newChild: LocalTask = { ...childTask, id: "child-2", title: "Texturizar" };
    const tasks = [parentTask, childTask, sibling];

    expect([...taskGraphDeleteIds(tasks, parentTask.id)]).toEqual(["parent-1", "child-1"]);
    expect(removeTaskGraph(tasks, parentTask.id)).toEqual([sibling]);
    expect(insertChildrenAfterExistingChildren(tasks, parentTask.id, [newChild])).toEqual([
      parentTask,
      childTask,
      newChild,
      sibling
    ]);
  });

  it("groups sub-tasks by parent for preflight and UI summaries", () => {
    expect(groupSubtasksByParent([parentTask, childTask])).toEqual([
      { parentTask, subtasks: [childTask] }
    ]);
    expect(groupSubtasksByParent([childTask], [parentTask, childTask])).toEqual([
      { parentTask, subtasks: [childTask] }
    ]);
    expect(groupSubtasksByParent([childTask])).toEqual([
      { parentTask: undefined, subtasks: [childTask] }
    ]);
  });
});
