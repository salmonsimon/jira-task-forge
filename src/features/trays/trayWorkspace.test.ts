import { describe, expect, it } from "vitest";
import type { LocalTask, Tray } from "../../lib/types";
import { buildTaskDetailsUpdate, cloneTrays, findTask, findTaskTray, repairTrayWorkspaceSelection } from "./trayWorkspace";

const baseTask: LocalTask = {
  id: "task-1",
  project: "DTS",
  area: "Bug",
  title: "Fix timer",
  priority: "High",
  issueType: "Bug",
  syncStatus: "Pending",
  descriptionStatus: "Missing",
  language: "Spanish",
  attachments: [{ id: "attachment-1", filename: "timer.png", purpose: "AI + Jira attachment", size: "12 B" }],
  syncLog: [{ id: "sync-1", timestamp: "Today", event: "created", detail: "Created" }]
};

const trays: Tray[] = [
  {
    id: "tray-1",
    name: "Prep tray",
    state: "Active",
    summary: "1 task",
    updatedAt: "Today",
    tasks: [baseTask]
  },
  {
    id: "tray-2",
    name: "Other tray",
    state: "Active",
    summary: "No tasks",
    updatedAt: "Today",
    tasks: []
  }
];

describe("tray workspace helpers", () => {
  it("deep-clones tray task metadata for local preview state", () => {
    const cloned = cloneTrays(trays);

    expect(cloned).toEqual(trays);
    expect(cloned).not.toBe(trays);
    expect(cloned[0]).not.toBe(trays[0]);
    expect(cloned[0].tasks[0]).not.toBe(trays[0].tasks[0]);
    expect(cloned[0].tasks[0].attachments?.[0]).not.toBe(trays[0].tasks[0].attachments?.[0]);
    expect(cloned[0].tasks[0].syncLog?.[0]).not.toBe(trays[0].tasks[0].syncLog?.[0]);
  });

  it("repairs stale tray and task selection after persisted refreshes", () => {
    expect(
      repairTrayWorkspaceSelection(
        trays,
        {
          selectedTrayId: "missing-tray",
          selectedTaskId: "missing-task",
          lastSelectedTrayId: "missing-last-tray"
        },
        {
          selectedTrayId: "tray-2",
          selectedTaskId: "task-1"
        }
      )
    ).toEqual({
      selectedTrayId: "tray-2",
      selectedTaskId: "task-1",
      lastSelectedTrayId: null
    });
  });

  it("finds the selected task and owning tray", () => {
    expect(findTask(trays, "task-1")).toEqual(baseTask);
    expect(findTaskTray(trays, "task-1")?.id).toBe("tray-1");
    expect(findTask(trays, "missing-task")).toBeNull();
    expect(findTaskTray(trays, null)).toBeNull();
  });

  it("invalidates an existing description when the task area changes", () => {
    const readyTask: LocalTask = {
      ...baseTask,
      area: "Arquitectura",
      issueType: "Story",
      description: "## Contexto\nDescripcion anterior.",
      descriptionStatus: "Ready"
    };

    expect(buildTaskDetailsUpdate(readyTask, { area: "Feeling" })).toEqual({
      ...readyTask,
      area: "Feeling",
      issueType: "Story",
      description: undefined,
      descriptionStatus: "Missing"
    });
  });
});
