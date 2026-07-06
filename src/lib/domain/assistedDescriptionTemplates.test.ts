import { describe, expect, it } from "vitest";
import {
  buildAssistedDescriptionGenerationContext,
  findAssistedDescriptionSectionId,
  formatAssistedDescriptionSectionScopeLabel,
  getAssistedDescriptionSectionIds,
  getAssistedDescriptionSectionLabel,
  getAssistedDescriptionTemplatePolicy,
  isAssistedDescriptionWrapperHeading
} from "./assistedDescriptionTemplates";

describe("assisted description template policy", () => {
  it("selects Story sections for non-Bug parent issues", () => {
    const policy = getAssistedDescriptionTemplatePolicy("Story");

    expect(policy.issueType).toBe("Story");
    expect(policy.sections.map((section) => section.markdownHeading)).toEqual([
      "Historia de usuario",
      "Contexto",
      "Alcance",
      "Criterios de aceptacion",
      "Entregable mínimo",
      "Checklist antes de Review"
    ]);
  });

  it("selects Bug sections for Bug or Error parent issues", () => {
    expect(getAssistedDescriptionTemplatePolicy("Bug").sections.map((section) => section.markdownHeading)).toEqual([
      "Problema",
      "Contexto / impacto",
      "Pasos para reproducir",
      "Resultado actual",
      "Resultado esperado",
      "Evidencia",
      "Criterios de aceptacion",
      "Entregable mínimo",
      "Checklist antes de Review"
    ]);
    expect(getAssistedDescriptionSectionIds("Error")).toContain("reproduction_steps");
    expect(getAssistedDescriptionSectionIds("Error")).not.toContain("user_story");
  });

  it("owns heading aliases and wrapper headings for proposal parsing", () => {
    expect(findAssistedDescriptionSectionId("Criterios de aceptación")).toBe("acceptance_criteria");
    expect(findAssistedDescriptionSectionId("Contexto / impacto")).toBe("context_impact");
    expect(findAssistedDescriptionSectionId("Steps to reproduce")).toBe("reproduction_steps");
    expect(isAssistedDescriptionWrapperHeading("SRS Lite")).toBe(true);
  });

  it("builds generation scope text from the selected policy", () => {
    const bugPrompt = buildAssistedDescriptionGenerationContext({
      changeRequest: "Usar la evidencia adjunta.",
      issueType: "Bug",
      sectionIds: getAssistedDescriptionSectionIds("Bug")
    });
    const storyPrompt = buildAssistedDescriptionGenerationContext({
      changeRequest: "",
      issueType: "Story",
      sectionIds: ["scope"]
    });

    expect(bugPrompt).toContain("fixed Bug Jira description sections");
    expect(bugPrompt).toContain("Steps to reproduce");
    expect(bugPrompt).toContain("Do not include suggested sub-tasks");
    expect(storyPrompt).toContain("Revise only these fixed Story Jira description sections: Scope");
  });

  it("formats UI section labels without duplicating policy in callers", () => {
    expect(getAssistedDescriptionSectionLabel("context_impact", "Bug")).toBe("Context / impact");
    expect(formatAssistedDescriptionSectionScopeLabel(getAssistedDescriptionSectionIds("Bug"), "Bug")).toBe("all proposal sections");
    expect(formatAssistedDescriptionSectionScopeLabel(["context_impact"], "Bug")).toBe("Context / impact");
  });
});
