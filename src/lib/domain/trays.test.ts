import { describe, expect, it } from "vitest";
import { deriveTrayStateFromTasks, deriveTrayStatusTag, isTrayComplete } from "./trays";

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
    expect(deriveTrayStatusTag([{ syncStatus: "Pending" }, { syncStatus: "Exported" }])).toBe("Exported");
    expect(deriveTrayStatusTag([{ syncStatus: "Created" }])).toBe("Completed");
    expect(deriveTrayStatusTag([{ syncStatus: "Failed" }, { syncStatus: "Exported" }])).toBe("Needs attention");
    expect(deriveTrayStatusTag([{ syncStatus: "Exported" }], "Archived")).toBe("Archived");
  });
});
