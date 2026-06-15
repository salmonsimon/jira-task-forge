import { describe, expect, it } from "vitest";
import { classifyTrayPreflightWarnings } from "../domain/preflight";
import { filterParentTasksByTraySearch } from "../domain/traySearch";
import type { LocalTask, Priority, SyncStatus } from "../types";
import { createLargeTraySmokeScenario } from "./largeTraySmoke";

describe("large tray smoke scenario", () => {
  it("builds a repeatable 200 Local Task tray with mixed task metadata", () => {
    const tray = createLargeTraySmokeScenario();

    expect(tray.id).toBe("tray-large-smoke-200");
    expect(tray.tasks).toHaveLength(200);
    expect(new Set(tray.tasks.map((task) => task.id)).size).toBe(200);
    expect(countBy(tray.tasks, (task) => task.issueType).get("Sub-task")).toBe(40);
    expect(countBy(tray.tasks, (task) => task.project).size).toBeGreaterThanOrEqual(4);
    expect(countBy(tray.tasks, (task) => task.area).size).toBeGreaterThanOrEqual(8);
    expect(hasAllValues(tray.tasks, (task) => task.priority, ["Lowest", "Low", "Medium", "High", "Highest"])).toBe(true);
    expect(hasAllValues(tray.tasks, (task) => task.syncStatus, ["Pending", "Failed", "Exported", "Created"])).toBe(true);
    expect(tray.tasks.filter((task) => task.descriptionStatus === "Ready" && task.description)).not.toHaveLength(0);
    expect(tray.tasks.filter((task) => task.descriptionStatus === "Draft" && task.notes)).not.toHaveLength(0);
    expect(tray.tasks.filter((task) => task.descriptionStatus === "Missing")).not.toHaveLength(0);
    expect(tray.tasks.filter((task) => task.attachments?.length)).not.toHaveLength(0);
    expect(tray.tasks.some((task) => task.jiraKey?.startsWith("DTS-") || task.jiraUrl?.includes("/browse/DTS-"))).toBe(false);
  });

  it("exercises search and preflight seams without requiring Jira writes", () => {
    const tray = createLargeTraySmokeScenario();

    const referencesMatches = filterParentTasksByTraySearch(tray.tasks, "referencias");
    const missingDescriptionWarnings = classifyTrayPreflightWarnings(tray.tasks).filter(
      (warning) => warning.code === "missing-description"
    );
    const exportedWarnings = classifyTrayPreflightWarnings(tray.tasks).filter(
      (warning) => warning.code === "exported-duplicate-risk"
    );

    expect(referencesMatches.length).toBeGreaterThan(0);
    expect(referencesMatches.every((task) => task.issueType !== "Sub-task")).toBe(true);
    expect(missingDescriptionWarnings.length).toBeGreaterThan(0);
    expect(exportedWarnings.length).toBeGreaterThan(0);
  });
});

function countBy<TValue extends string>(
  tasks: LocalTask[],
  selectValue: (task: LocalTask) => TValue
): Map<TValue, number> {
  return tasks.reduce((counts, task) => {
    const value = selectValue(task);
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map<TValue, number>());
}

function hasAllValues<TValue extends Priority | SyncStatus>(
  tasks: LocalTask[],
  selectValue: (task: LocalTask) => TValue,
  expectedValues: TValue[]
): boolean {
  const values = new Set(tasks.map(selectValue));
  return expectedValues.every((value) => values.has(value));
}
