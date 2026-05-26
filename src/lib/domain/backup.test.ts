import { describe, expect, it } from "vitest";
import { formatBackupCountLabel, formatBackupTimestamp, getVisibleBackupCounts } from "./backup";

describe("backup workflow domain helpers", () => {
  it("formats stable backup timestamps for native save defaults", () => {
    expect(formatBackupTimestamp(new Date("2026-05-25T21:04:05"))).toBe("20260525-210405");
  });

  it("filters empty backup counts and uses product labels", () => {
    expect(
      getVisibleBackupCounts({
        trays: 1,
        tasks: 3,
        categories: 0,
        epicMappings: 2,
        jqlFavorites: 1,
        attachmentMetadata: 4,
        customFutureRecord: 2
      })
    ).toEqual([
      { label: "tray", count: 1 },
      { label: "tasks", count: 3 },
      { label: "epic mappings", count: 2 },
      { label: "JQL favorite", count: 1 },
      { label: "attachment metadata", count: 4 },
      { label: "customFutureRecord", count: 2 }
    ]);
  });

  it("pluralizes known backup record labels", () => {
    expect(formatBackupCountLabel("settings", 1)).toBe("setting");
    expect(formatBackupCountLabel("settings", 2)).toBe("settings");
    expect(formatBackupCountLabel("auditSummaries", 1)).toBe("audit summary");
    expect(formatBackupCountLabel("auditSummaries", 7)).toBe("audit summaries");
  });
});
