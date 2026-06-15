import { describe, expect, it } from "vitest";
import {
  applyManualAssistedDescriptionSectionEdit,
  assistedDescriptionSectionDefinitions,
  buildAssistedDescriptionParagraphDiff,
  buildAssistedDescriptionProposal,
  buildResolveAssistedDescriptionProposalItemPatch,
  buildResolveAssistedDescriptionProposalPatch,
  createEmptyAssistedDescriptionSectionStatuses,
  getAssistedDescriptionProposalItems,
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
    expect(Object.keys(sections)).toEqual(assistedDescriptionSectionDefinitions.map((section) => section.id));
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
    expect(proposal.sections).toHaveLength(4);
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
});
