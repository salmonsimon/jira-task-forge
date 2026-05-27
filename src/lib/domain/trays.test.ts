import { describe, expect, it } from "vitest";
import type { Tray } from "../types";
import { deriveTrayStateFromTasks, deriveTrayStatusTag, isTrayComplete, summarizeTrayTasks, updateTrayTasks } from "./trays";

describe("tray domain helpers", () => {
  it("requires at least one created task to be complete", () => {
    expect(isTrayComplete([])).toBe(false);
    expect(isTrayComplete([{ syncStatus: "Created" }])).toBe(true);
    expect(isTrayComplete([{ syncStatus: "Created" }, { syncStatus: "Pending" }])).toBe(false);
  });

  it("derives tray state while preserving archived trays", () => {
    expect(deriveTrayStateFromTasks([{ syncStatus: "Created" }])).toBe("Completed");
    expect(deriveTrayStateFromTasks([{ syncStatus: "Failed" }])).toBe("Needs attention");
    expect(deriveTrayStateFromTasks([{ syncStatus: "Pending" }])).toBe("Active");
    expect(deriveTrayStateFromTasks([{ syncStatus: "Failed" }], "Archived")).toBe("Archived");
  });

  it("shows exported as a tray status tag for active trays with exported tasks", () => {
    expect(deriveTrayStatusTag([{ syncStatus: "Exported" }])).toBe("Exported");
    expect(deriveTrayStatusTag([{ syncStatus: "Created" }, { syncStatus: "Exported" }])).toBe("Exported");
    expect(deriveTrayStatusTag([{ syncStatus: "Pending" }, { syncStatus: "Exported" }])).toBe("Active");
    expect(deriveTrayStatusTag([{ syncStatus: "Created" }])).toBe("Completed");
    expect(deriveTrayStatusTag([{ syncStatus: "Failed" }, { syncStatus: "Exported" }])).toBe("Needs attention");
    expect(deriveTrayStatusTag([{ syncStatus: "Exported" }], "Archived")).toBe("Archived");
  });

  it("summarizes parent tasks and sub-tasks consistently", () => {
    expect(summarizeTrayTasks([])).toBe("No tasks");
    expect(
      summarizeTrayTasks([
        { issueType: "Story", parentTaskId: undefined, syncStatus: "Pending" },
        { issueType: "Bug", parentTaskId: undefined, syncStatus: "Created" },
        { issueType: "Sub-task", parentTaskId: "parent-1", syncStatus: "Pending" }
      ])
    ).toBe("2 tasks · 1 sub-task · 1 pending · 1 created");
  });

  it("refreshes tray status fields when tasks change", () => {
    const tray: Tray = {
      id: "tray-1",
      name: "Prep tray",
      state: "Active",
      summary: "No tasks",
      updatedAt: "Yesterday",
      tasks: []
    };

    expect(
      updateTrayTasks(tray, [
        {
          id: "task-1",
          project: "DTS",
          area: "Bug",
          title: "Fix timer",
          priority: "High",
          issueType: "Bug",
          syncStatus: "Failed",
          descriptionStatus: "Missing",
          language: "Spanish"
        }
      ])
    ).toMatchObject({
      state: "Needs attention",
      summary: "1 task · 1 failed",
      updatedAt: "Just now"
    });
  });
});
