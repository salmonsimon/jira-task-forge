import { describe, expect, it } from "vitest";
import {
  buildProjectSyncReview,
  extractProjectNameFromEpicSummary,
  normalizeProjectNameForSync
} from "./projectSync";

describe("project sync decisions", () => {
  it("discovers Projects only from bracketed Jira epic summaries", () => {
    expect(extractProjectNameFromEpicSummary("[PilotLab] [Programación] Demo Version 1")).toBe("PilotLab");
    expect(extractProjectNameFromEpicSummary("[MR Studio] VFX")).toBe("MR Studio");
    expect(extractProjectNameFromEpicSummary("PilotLab [Programación] Demo Version 1")).toBeNull();
    expect(extractProjectNameFromEpicSummary("[Bug] Fix timer drift")).toBeNull();
  });

  it("normalizes names so local Projects can be promoted without duplicates", () => {
    expect(normalizeProjectNameForSync(" MR   Studio ")).toBe("mr-studio");
    expect(normalizeProjectNameForSync("Programación")).toBe("programacion");
  });

  it("keeps Transversal active and first while promoting matching local Projects", () => {
    const review = buildProjectSyncReview({
      localProjects: [
        { name: "MR Studio", source: "local", hidden: false },
        { name: "Transversal", source: "jira", hidden: false }
      ],
      discoveredEpics: [
        { key: "JTFTEST-10", summary: "[PilotLab] [Bug] Demo Version 1" },
        { key: "JTFTEST-11", summary: "[MR Studio] [VFX] Demo Version 1" }
      ],
      rememberedDecisions: []
    });

    expect(review.sections.active.map((candidate) => candidate.name)).toEqual(["Transversal"]);
    expect(review.sections.new.map((candidate) => candidate.name)).toEqual(["MR Studio", "PilotLab"]);
    expect(review.sections.new[0].willPromoteLocal).toBe(true);
    expect(review.defaultActiveNames).toEqual(["Transversal", "MR Studio", "PilotLab"]);
  });
});
