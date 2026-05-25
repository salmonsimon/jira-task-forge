import { describe, expect, it } from "vitest";
import { deriveTrayStateFromTasks, isTrayComplete } from "./trays";

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
});
