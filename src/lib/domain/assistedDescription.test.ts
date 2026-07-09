import { describe, expect, it } from "vitest";
import {
  applyManualAssistedDescriptionSectionEdit,
  assistedDescriptionSectionDefinitions,
  bugAssistedDescriptionSectionDefinitions,
  buildAssistedDescriptionParagraphDiff,
  buildAssistedDescriptionProposal,
  buildResolveAssistedDescriptionProposalItemPatch,
  buildResolveAssistedDescriptionProposalPatch,
  createAssistedDescriptionSectionStatusesForTask,
  createEmptyAssistedDescriptionSectionStatuses,
  getAssistedDescriptionProposalItems,
  getAssistedDescriptionSectionIds,
  hasCompletePolishedAssistedDescription,
  hasReviewableAssistedDescriptionProposalItems,
  parseAssistedDescriptionMarkdown,
  reviseAssistedDescriptionProposal,
  serializeAssistedDescriptionSections,
  toNewAssistedDescriptionProposal
} from "./assistedDescription";

describe("assisted description domain helpers", () => {
  it("parses the fixed DTS sections and keeps empty sections in the model", () => {
    const sections = parseAssistedDescriptionMarkdown(`## Historia de usuario

Como jugador, quiero ver el timer.

## Contexto

El timer no siempre termina.

## Alcance

Incluye:
- Ajustar el cierre del timer.`);

    expect(sections.user_story).toBe("Como jugador, quiero ver el timer.");
    expect(sections.problem).toBe("El timer no siempre termina.");
    expect(sections.scope).toBe("Incluye:\n- Ajustar el cierre del timer.");
    expect(sections.acceptance_criteria).toBe("");
    expect(getAssistedDescriptionSectionIds("Story").every((sectionId) => sectionId in sections)).toBe(true);
  });

  it("parses and serializes the Bug template without converting it to Story headings", () => {
    const sections = parseAssistedDescriptionMarkdown(`## Problema

El timer no se detiene.

## Contexto / impacto

Afecta cierre de objetivos.

## Pasos para reproducir

1. Completar el objetivo.

## Resultado actual

El timer sigue corriendo.

## Resultado esperado

El timer se detiene.

## Evidencia

- Video de QA.

## Criterios de aceptación

- El timer se detiene.

## Entregable mínimo

- Fix aplicado.

## Checklist antes de Review

- Evidencia disponible.`, "Bug");

    expect(sections.problem).toBe("El timer no se detiene.");
    expect(sections.context_impact).toBe("Afecta cierre de objetivos.");
    expect(sections.reproduction_steps).toBe("1. Completar el objetivo.");
    expect(sections.actual_result).toBe("El timer sigue corriendo.");
    expect(sections.expected_result).toBe("El timer se detiene.");
    expect(sections.evidence).toBe("- Video de QA.");

    const markdown = serializeAssistedDescriptionSections(sections, "Bug");
    expect(markdown).toContain("## Problema\n\nEl timer no se detiene.");
    expect(markdown).toContain("## Contexto / impacto\n\nAfecta cierre de objetivos.");
    expect(markdown).toContain("## Pasos para reproducir\n\n1. Completar el objetivo.");
    expect(markdown).not.toContain("## Historia de usuario");
    expect(markdown).not.toContain("## Alcance");
  });

  it("maps legacy prototype headings into DTS section ids", () => {
    const sections = parseAssistedDescriptionMarkdown(`## Contexto

Contexto anterior.

## SRS Lite

### 2. Objetivo

Objetivo anterior.`);

    expect(sections.problem).toBe("Contexto anterior.");
    expect(sections.scope).toBe("Objetivo anterior.");
  });

  it("serializes every fixed section even when a section is empty", () => {
    const markdown = serializeAssistedDescriptionSections({
      ...parseAssistedDescriptionMarkdown(""),
      user_story: "Como usuario, quiero claridad.",
      acceptance_criteria: "- Se ve el resultado esperado."
    });

    expect(markdown).toContain("## Historia de usuario\n\nComo usuario, quiero claridad.");
    expect(markdown).toContain("## Contexto\n\n## Alcance");
    expect(markdown).toContain("## Criterios de aceptacion\n\n- Se ve el resultado esperado.");
    expect(markdown).not.toContain("SRS Lite");
    expect(markdown).not.toContain("SRE Lite");
  });

  it("builds a paragraph-level diff without returning unchanged paragraphs", () => {
    const diff = buildAssistedDescriptionParagraphDiff(
      "Same opening.\n\nOld paragraph.\n\nSame ending.",
      "Same opening.\n\nNew paragraph.\n\nSame ending."
    );

    expect(diff).toEqual([
      {
        current: "Old paragraph.",
        proposed: "New paragraph."
      }
    ]);
  });

  it("hides unchanged paragraphs when new paragraphs are inserted", () => {
    const diff = buildAssistedDescriptionParagraphDiff(
      "Same opening.\n\nSame ending.",
      "Same opening.\n\nInserted detail.\n\nSame ending."
    );

    expect(diff).toEqual([
      {
        current: "",
        proposed: "Inserted detail."
      }
    ]);
  });

  it("builds persisted proposal payloads with all DTS sections", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const proposal = buildAssistedDescriptionProposal({
      changeRequest: "Improve the scope.",
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      model: "gpt-4.1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        scope: "Clear scope"
      }),
      provider: "OpenAI",
      sectionIds: ["scope"],
      taskId: "task-1"
    });

    expect(proposal.status).toBe("Pending");
    expect(proposal.sections).toHaveLength(assistedDescriptionSectionDefinitions.length);
    expect(proposal.sections.map((section) => section.sectionId)).toEqual(
      assistedDescriptionSectionDefinitions.map((section) => section.id)
    );
    expect(proposal.sections.find((section) => section.sectionId === "user_story")?.currentContent).toBe("Raw story");
    expect(proposal.sections.find((section) => section.sectionId === "user_story")?.proposedContent).toBe("");
    expect(proposal.sections.find((section) => section.sectionId === "scope")?.proposedContent).toBe("Clear scope");
    expect(toNewAssistedDescriptionProposal(proposal)).toMatchObject({
      taskId: "task-1",
      title: "AI proposal: Scope",
      provider: "OpenAI",
      model: "gpt-4.1"
    });
  });

  it("builds Bug proposals with only Bug review sections", () => {
    const currentSections = parseAssistedDescriptionMarkdown("", "Bug");
    const proposedSections = {
      ...currentSections,
      problem: "El timer no se detiene.",
      context_impact: "Bloquea QA del cierre.",
      reproduction_steps: "1. Completar el objetivo.",
      actual_result: "El timer sigue activo.",
      expected_result: "El timer se detiene.",
      evidence: "- Video de QA.",
      acceptance_criteria: "- Timer detenido.",
      minimum_deliverable: "- Fix aplicado.",
      review_checklist: "- Evidencia disponible."
    };
    const proposal = buildAssistedDescriptionProposal({
      currentMarkdown: serializeAssistedDescriptionSections(currentSections, "Bug"),
      id: "proposal-bug",
      issueType: "Bug",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections(proposedSections, "Bug"),
      taskId: "task-bug"
    });

    expect(proposal.sections.map((section) => section.sectionId)).toEqual(
      bugAssistedDescriptionSectionDefinitions.map((section) => section.id)
    );
    expect(proposal.sections.map((section) => section.heading)).toEqual(
      bugAssistedDescriptionSectionDefinitions.map((section) => section.markdownHeading)
    );
    expect(proposal.sections.some((section) => section.sectionId === "user_story")).toBe(false);
    expect(proposal.sections.some((section) => section.sectionId === "scope")).toBe(false);
    expect(getAssistedDescriptionProposalItems(proposal)).toHaveLength(bugAssistedDescriptionSectionDefinitions.length);
  });

  it("identifies provider output with no reviewable changes", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const proposal = buildAssistedDescriptionProposal({
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections(currentSections),
      taskId: "task-1"
    });

    expect(getAssistedDescriptionProposalItems(proposal)).toEqual([]);
    expect(hasReviewableAssistedDescriptionProposalItems(proposal)).toBe(false);
  });

  it("marks revised proposal sections with the reviewer request", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const proposal = buildAssistedDescriptionProposal({
      changeRequest: "Initial draft.",
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        scope: "Clear scope"
      }),
      sectionIds: ["scope"],
      taskId: "task-1"
    });
    const revision = buildAssistedDescriptionProposal({
      changeRequest: "Make the scope measurable.",
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-revision",
      now: "2026-05-27T12:05:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        scope: "Measurable scope"
      }),
      sectionIds: ["scope"],
      taskId: "task-1"
    });

    const revisedProposal = reviseAssistedDescriptionProposal(
      proposal,
      revision,
      ["scope"],
      "2026-05-27T12:06:00.000Z"
    );
    const item = getAssistedDescriptionProposalItems(revisedProposal).find((candidate) => candidate.sectionId === "scope");

    expect(item?.proposedValue).toBe("Measurable scope");
    expect(item?.reviewerComment).toBe("Make the scope measurable.");
  });

  it("keeps reviewer-requested empty proposal sections reviewable", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const proposal = buildAssistedDescriptionProposal({
      changeRequest: "Initial draft.",
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        problem: "Context detail"
      }),
      sectionIds: ["problem"],
      taskId: "task-1"
    });
    const emptyRevision = buildAssistedDescriptionProposal({
      changeRequest: "Leave this section empty.",
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-revision",
      now: "2026-05-27T12:05:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        problem: ""
      }),
      sectionIds: ["problem"],
      taskId: "task-1"
    });

    const revisedProposal = reviseAssistedDescriptionProposal(
      proposal,
      emptyRevision,
      ["problem"],
      "2026-05-27T12:06:00.000Z"
    );
    const items = getAssistedDescriptionProposalItems(revisedProposal);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      proposedValue: "",
      reviewerComment: "Leave this section empty.",
      sectionId: "problem"
    });

    const patch = buildResolveAssistedDescriptionProposalItemPatch(
      {
        sections: currentSections,
        sectionStatuses: createEmptyAssistedDescriptionSectionStatuses()
      },
      revisedProposal,
      items[0].id,
      true,
      "2026-05-27T12:07:00.000Z"
    );

    expect(getAssistedDescriptionProposalItems(patch!.proposal)[0].status).toBe("accepted");
  });

  it("accepts one proposal section and marks only meaningful accepted content polished", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const statuses = createEmptyAssistedDescriptionSectionStatuses();
    const proposal = buildAssistedDescriptionProposal({
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        user_story: "Polished story",
        problem: ""
      }),
      sectionIds: ["user_story", "problem"],
      taskId: "task-1"
    });
    const storyItem = getAssistedDescriptionProposalItems(proposal).find((item) => item.sectionId === "user_story");

    const patch = buildResolveAssistedDescriptionProposalItemPatch(
      { sections: currentSections, sectionStatuses: statuses },
      proposal,
      storyItem?.id ?? "",
      true,
      "2026-05-27T12:05:00.000Z"
    );

    expect(patch?.sections.user_story).toBe("Polished story");
    expect(patch?.sectionStatuses.user_story).toBe("Polished");
    expect(patch?.sectionStatuses.problem).toBe("Raw");
    expect(patch?.proposal.status).toBe("Pending");
    expect(patch?.proposal.sections.find((section) => section.sectionId === "user_story")?.status).toBe("Polished");
    expect(patch?.shouldApplyDescription).toBe(true);
  });

  it("keeps item-level rejection as a pending raw section until the proposal is finalized", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const proposal = buildAssistedDescriptionProposal({
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        user_story: "Polished story"
      }),
      sectionIds: ["user_story"],
      taskId: "task-1"
    });
    const storyItem = getAssistedDescriptionProposalItems(proposal)[0];

    const patch = buildResolveAssistedDescriptionProposalItemPatch(
      {
        sections: currentSections,
        sectionStatuses: createEmptyAssistedDescriptionSectionStatuses()
      },
      proposal,
      storyItem.id,
      false,
      "2026-05-27T12:05:00.000Z"
    );

    expect(patch?.sections.user_story).toBe("Raw story");
    expect(patch?.proposal.status).toBe("Pending");
    expect(patch?.proposal.sections.find((section) => section.sectionId === "user_story")?.status).toBe("Raw");
    expect(getAssistedDescriptionProposalItems(patch!.proposal)[0].status).toBe("pending");
    expect(patch?.shouldApplyDescription).toBe(false);
  });

  it("keeps persisted item-level rejections rejected when accepting the remaining sections", () => {
    const currentSections = parseAssistedDescriptionMarkdown("");
    const proposal = buildAssistedDescriptionProposal({
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        user_story: "Polished story",
        problem: "Rejected context"
      }),
      sectionIds: ["user_story", "problem"],
      taskId: "task-1"
    });
    const withRejectedSection = {
      ...proposal,
      sections: proposal.sections.map((section) =>
        section.sectionId === "problem"
          ? { ...section, reviewerComment: "Rejected Context.", status: "Raw" as const }
          : section
      )
    };

    expect(getAssistedDescriptionProposalItems(withRejectedSection).find((item) => item.sectionId === "problem")?.status).toBe("rejected");

    const patch = buildResolveAssistedDescriptionProposalPatch(
      {
        sections: currentSections,
        sectionStatuses: createEmptyAssistedDescriptionSectionStatuses()
      },
      withRejectedSection,
      true,
      "2026-05-27T12:05:00.000Z"
    );

    expect(patch?.proposal.status).toBe("Partial");
    expect(patch?.sections.user_story).toBe("Polished story");
    expect(patch?.sections.problem).toBe("");
    expect(patch?.sectionStatuses.user_story).toBe("Polished");
    expect(patch?.sectionStatuses.problem).toBe("Raw");
    expect(patch?.proposal.sections.find((section) => section.sectionId === "user_story")?.status).toBe("Polished");
    expect(patch?.proposal.sections.find((section) => section.sectionId === "problem")?.status).toBe("Raw");
  });

  it("rejects remaining proposal sections without changing description content", () => {
    const currentSections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const proposal = buildAssistedDescriptionProposal({
      currentMarkdown: serializeAssistedDescriptionSections(currentSections),
      id: "proposal-1",
      now: "2026-05-27T12:00:00.000Z",
      proposedMarkdown: serializeAssistedDescriptionSections({
        ...currentSections,
        user_story: "Polished story"
      }),
      taskId: "task-1"
    });

    const patch = buildResolveAssistedDescriptionProposalPatch(
      {
        sections: currentSections,
        sectionStatuses: createEmptyAssistedDescriptionSectionStatuses()
      },
      proposal,
      false,
      "2026-05-27T12:05:00.000Z"
    );

    expect(patch?.sections.user_story).toBe("Raw story");
    expect(patch?.sectionStatuses.user_story).toBe("Raw");
    expect(patch?.proposal.status).toBe("Rejected");
    expect(getAssistedDescriptionProposalItems(patch!.proposal).every((item) => item.status === "rejected")).toBe(true);
    expect(patch?.shouldApplyDescription).toBe(false);
  });

  it("marks manual meaningful edits polished and cleared sections raw", () => {
    const sections = parseAssistedDescriptionMarkdown("## Historia de usuario\n\nRaw story");
    const statuses = createEmptyAssistedDescriptionSectionStatuses();

    const polished = applyManualAssistedDescriptionSectionEdit(
      { sections, sectionStatuses: statuses },
      "user_story",
      "Edited story"
    );
    const cleared = applyManualAssistedDescriptionSectionEdit(polished, "user_story", "   ");

    expect(polished.sectionStatuses.user_story).toBe("Polished");
    expect(cleared.sections.user_story).toBe("");
    expect(cleared.sectionStatuses.user_story).toBe("Raw");
  });

  it("treats a ready persisted task as polished only when every active section has content", () => {
    const readySections = {
      ...parseAssistedDescriptionMarkdown(""),
      user_story: "Como usuario, quiero claridad.",
      problem: "Hay contexto suficiente.",
      scope: "Incluye el flujo principal.",
      acceptance_criteria: "- Cumple el resultado esperado.",
      minimum_deliverable: "- Cambio verificable.",
      review_checklist: "- Revisar en build."
    };
    const statuses = createAssistedDescriptionSectionStatusesForTask(readySections, "Ready", "Story");

    expect(hasCompletePolishedAssistedDescription({ sections: readySections, sectionStatuses: statuses }, "Story")).toBe(true);

    const incompleteSections = {
      ...readySections,
      review_checklist: ""
    };
    const incompleteStatuses = createAssistedDescriptionSectionStatusesForTask(incompleteSections, "Ready", "Story");

    expect(hasCompletePolishedAssistedDescription({ sections: incompleteSections, sectionStatuses: incompleteStatuses }, "Story")).toBe(false);
    expect(incompleteStatuses.review_checklist).toBe("Raw");
  });

  it("promotes a manually completed final section to a complete polished description", () => {
    const sections = {
      ...parseAssistedDescriptionMarkdown(""),
      user_story: "Como usuario, quiero claridad.",
      problem: "Hay contexto suficiente.",
      scope: "Incluye el flujo principal.",
      acceptance_criteria: "- Cumple el resultado esperado.",
      minimum_deliverable: "- Cambio verificable.",
      review_checklist: ""
    };
    const startedStatuses = createAssistedDescriptionSectionStatusesForTask({
      ...sections,
      review_checklist: "- Revisar en build."
    }, "Ready", "Story");
    const currentStatuses = {
      ...startedStatuses,
      review_checklist: "Raw" as const
    };

    const completed = applyManualAssistedDescriptionSectionEdit(
      { sections, sectionStatuses: currentStatuses },
      "review_checklist",
      "- Revisar en build."
    );

    expect(completed.sectionStatuses.review_checklist).toBe("Polished");
    expect(hasCompletePolishedAssistedDescription(completed, "Story")).toBe(true);
  });
});
