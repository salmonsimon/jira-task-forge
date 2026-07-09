import { describe, expect, it } from "vitest";
import { areas, projects } from "./data";

describe("fallback category defaults", () => {
  it("starts with only Transversal as the default Project", () => {
    expect(projects).toEqual([
      {
        categoryType: "project",
        id: "project-transversal",
        name: "Transversal",
        source: "jira"
      }
    ]);
  });

  it("does not seed default Areas before catalog sync or manual setup", () => {
    expect(areas).toEqual([]);
  });
});
