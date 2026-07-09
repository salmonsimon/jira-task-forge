import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AssistedDescriptionSection,
  DescriptionPromptModal,
  TaskDetailNestedModalShell,
  buildProposalTransitionRequest,
  dedupeProposalLogEntries,
  getAiProviderSetupActionLabel,
  isAiProviderSetupMessage,
  resolveDeliveryFormatPromptAction
} from "./AssistedDescriptionSection";
import type { LocalTask } from "../../lib/types";

const overlay = {
  id: "task-detail-test-modal",
  isTopmost: () => true,
  backdropProps: {
    onPointerDown: () => undefined
  },
  surfaceProps: {
    onPointerDown: () => undefined
  }
};

describe("TaskDetailNestedModalShell", () => {
  it("renders task-detail nested modals with a labeled dialog shell", () => {
    const html = renderToStaticMarkup(
      <TaskDetailNestedModalShell
        dataDescriptionEditor
        footer={<button type="button">Done</button>}
        icon={<span aria-hidden="true">*</span>}
        maxWidthClassName="max-w-[520px]"
        onClose={() => undefined}
        overlay={overlay}
        subtitle="Shared modal subtitle"
        title="Shared modal title"
      >
        <p>Shared modal body</p>
      </TaskDetailNestedModalShell>
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="task-detail-test-modal-title"');
    expect(html).toContain('id="task-detail-test-modal-title"');
    expect(html).toContain('data-description-editor="true"');
    expect(html).toContain("Shared modal body");
    expect(html).toContain("Done");
  });
});

describe("DescriptionPromptModal AI setup warning", () => {
  it("offers a direct setup action for missing AI provider configuration", () => {
    const html = renderToStaticMarkup(
      <DescriptionPromptModal
        clarificationQuestions={[]}
        descriptionContext=""
        descriptionMessage="Select an AI provider in Settings before generating a description."
        isGeneratingDescription={false}
        onCancel={() => undefined}
        onChange={() => undefined}
        onConfigureAiProvider={() => undefined}
        onGenerate={() => undefined}
        onKeyDown={() => undefined}
      />
    );

    expect(isAiProviderSetupMessage("Select an AI provider in Settings before generating a description.")).toBe(true);
    expect(isAiProviderSetupMessage("Save a OpenAI API key in Settings before generating a description.")).toBe(true);
    expect(getAiProviderSetupActionLabel("Save a OpenAI API key in Settings before generating a description.")).toBe("Save API key");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Description context");
    expect(html).toContain("Configure OpenAI");
  });
});

describe("DescriptionPromptModal delivery-format gate", () => {
  it("skips delivery-format confirmation when catalog gate is auto", () => {
    expect(
      resolveDeliveryFormatPromptAction({
        kind: "auto",
        areaDisplayName: "Manual Area",
        format: null,
        options: []
      })
    ).toEqual({ kind: "generate", deliveryFormat: null });
  });

  it("passes explicit auto delivery formats through to generation", () => {
    expect(
      resolveDeliveryFormatPromptAction({
        kind: "auto",
        areaDisplayName: "Synced Area",
        format: "Formato Unico",
        options: ["Formato Unico"]
      })
    ).toEqual({ kind: "generate", deliveryFormat: "Formato Unico" });
  });

  it("requires generic synced delivery-format confirmation before generation", () => {
    const action = resolveDeliveryFormatPromptAction({
      kind: "needs_confirmation",
      areaDisplayName: "Synced Area",
      suggestedFormat: null,
      options: ["Formato A", "Formato B"]
    });

    expect(action).toEqual({
      kind: "confirm",
      selectedDeliveryFormat: "",
      message: "Choose the delivery format for this description proposal."
    });
  });

  it("auto-selects the first mapped format for individual section proposals", () => {
    const action = resolveDeliveryFormatPromptAction(
      {
        kind: "needs_confirmation",
        areaDisplayName: "3D",
        suggestedFormat: null,
        options: ["Arte Integrado", "Arte Empaquetado"]
      },
      { autoSelectFirstConfirmationOption: true }
    );

    expect(action).toEqual({ kind: "generate", deliveryFormat: "Arte Integrado" });
  });

  it("prefers a valid suggested format for individual section proposals", () => {
    const action = resolveDeliveryFormatPromptAction(
      {
        kind: "needs_confirmation",
        areaDisplayName: "3D",
        suggestedFormat: "Arte Empaquetado",
        options: ["Arte Integrado", "Arte Empaquetado"]
      },
      { autoSelectFirstConfirmationOption: true }
    );

    expect(action).toEqual({ kind: "generate", deliveryFormat: "Arte Empaquetado" });
  });

  it("auto-generates when the synced catalog has exactly one delivery format option", () => {
    expect(
      resolveDeliveryFormatPromptAction({
        kind: "needs_confirmation",
        areaDisplayName: "Bug",
        suggestedFormat: null,
        options: ["Bug"]
      })
    ).toEqual({ kind: "generate", deliveryFormat: "Bug" });
  });

  it("preselects a synced suggested format without hardcoding catalog values", () => {
    const action = resolveDeliveryFormatPromptAction({
      kind: "needs_confirmation",
      areaDisplayName: "Synced Area",
      suggestedFormat: "Formato B",
      options: ["Formato A", "Formato B"]
    });

    expect(action).toEqual({
      kind: "confirm",
      selectedDeliveryFormat: "Formato B",
      message: "Review the selected delivery format before continuing."
    });
  });

  it("keeps delivery-format confirmation out of the context step", () => {
    const html = renderToStaticMarkup(
      <DescriptionPromptModal
        clarificationQuestions={[]}
        descriptionContext=""
        descriptionMessage={null}
        deliveryFormatGate={{
          kind: "needs_confirmation",
          areaDisplayName: "Arquitectura",
          suggestedFormat: "Arquitectura - Propuesta Final",
          options: ["Arquitectura - Brief", "Arquitectura - Propuesta Final"]
        }}
        isGeneratingDescription={false}
        onCancel={() => undefined}
        onChange={() => undefined}
        onGenerate={() => undefined}
        onKeyDown={() => undefined}
        onSelectDeliveryFormat={() => undefined}
        selectedDeliveryFormat="Arquitectura - Propuesta Final"
        step="context"
      />
    );

    expect(html).toContain("Description context");
    expect(html).toContain("Generate proposal");
    expect(html).not.toContain("Delivery format");
  });

  it("renders only valid mapped delivery formats in the confirmation step", () => {
    const html = renderToStaticMarkup(
      <DescriptionPromptModal
        clarificationQuestions={[]}
        deliveryFormatGate={{
          kind: "needs_confirmation",
          areaDisplayName: "Synced Area",
          suggestedFormat: "Formato B",
          options: ["Formato A", "Formato B"]
        }}
        descriptionContext=""
        descriptionMessage="Confirm the delivery format before generating the description proposal."
        isGeneratingDescription={false}
        onCancel={() => undefined}
        onChange={() => undefined}
        onGenerate={() => undefined}
        onKeyDown={() => undefined}
        onSelectDeliveryFormat={() => undefined}
        selectedDeliveryFormat="Formato B"
        step="delivery_format"
      />
    );

    expect(html).toContain("Choose delivery format");
    expect(html).toContain("Delivery format");
    expect(html).toContain("Continue");
    expect(html).toContain("Formato B");
    expect(html).not.toContain("Edit context");
    expect(html).not.toContain("Formato inventado");
    expect(html).not.toContain("Context used for inference");
    expect(html).not.toContain("Could not infer");
    expect(html).not.toContain("<select");
  });

  it("asks for a delivery format without inference copy", () => {
    const html = renderToStaticMarkup(
      <DescriptionPromptModal
        clarificationQuestions={[]}
        deliveryFormatGate={{
          kind: "needs_confirmation",
          areaDisplayName: "Arquitectura",
          suggestedFormat: null,
          options: ["Arquitectura - Brief", "Arquitectura - Propuesta Final"]
        }}
        descriptionContext="Necesitamos ordenar el trabajo pendiente."
        descriptionMessage={null}
        isGeneratingDescription={false}
        onCancel={() => undefined}
        onChange={() => undefined}
        onGenerate={() => undefined}
        onKeyDown={() => undefined}
        onSelectDeliveryFormat={() => undefined}
        selectedDeliveryFormat=""
        step="delivery_format"
      />
    );

    expect(html).toContain("Choose delivery format");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Context used for inference");
    expect(html).not.toContain("Could not infer");
  });

  it("renders generation failures as warning feedback instead of info", () => {
    const html = renderToStaticMarkup(
      <DescriptionPromptModal
        clarificationQuestions={[]}
        descriptionContext="Crear bug de manos VR"
        descriptionMessage="Could not generate a description proposal."
        isGeneratingDescription={false}
        onCancel={() => undefined}
        onChange={() => undefined}
        onGenerate={() => undefined}
        onKeyDown={() => undefined}
      />
    );

    expect(html).toContain("Could not generate a description proposal.");
    expect(html).toContain("bg-[#3f3102]");
    expect(html).not.toContain("bg-[#102d50]");
  });
});

describe("proposal transition request", () => {
  it("marks partial accept-remaining transitions so the backend applies pending sections", () => {
    const transition = buildProposalTransitionRequest(mixedProposal, true);

    expect(transition).toEqual({
      status: "Partial",
      reviewerComment: "Accepted remaining proposal sections.",
      applyToTaskDescription: true
    });
  });

  it("marks partial reject-remaining transitions so accepted sections stay applied", () => {
    const transition = buildProposalTransitionRequest(mixedProposal, false);

    expect(transition).toEqual({
      status: "Partial",
      reviewerComment: "Rejected remaining proposal sections.",
      applyToTaskDescription: true
    });
  });
});

describe("AssistedDescriptionSection polished state", () => {
  it("disables the bulk polished action when the ready description is already polished", () => {
    const html = renderToStaticMarkup(
      <AssistedDescriptionSection
        task={taskWithDescription("Ready", completeStoryDescription)}
        readOnly={false}
        isGeneratingDescription={false}
        onGenerateDescription={async () => ({ status: "drafted", description: completeStoryDescription, clarificationQuestions: [] })}
        onSaveDescription={() => undefined}
      />
    );

    expect(html).toContain("Set all as polished");
    expect(html).toContain("Every description section is already polished");
    expect(html).toContain("disabled");
  });

  it("keeps the bulk polished action disabled when required sections are missing", () => {
    const html = renderToStaticMarkup(
      <AssistedDescriptionSection
        task={taskWithDescription("Draft", "## Historia de usuario\n\nComo usuario, quiero claridad.")}
        readOnly={false}
        isGeneratingDescription={false}
        onGenerateDescription={async () => ({ status: "drafted", description: completeStoryDescription, clarificationQuestions: [] })}
        onSaveDescription={() => undefined}
      />
    );

    expect(html).toContain("Set all as polished");
    expect(html).toContain("Complete every description section before marking the task as ready");
    expect(html).toContain("disabled");
  });
});

const mixedProposal = {
  createdAt: "2026-07-09T00:00:00.000Z",
  decidedAt: null,
  id: "proposal-1",
  model: "gpt-4.1",
  provider: "OpenAI",
  sections: [
    {
      currentContent: "",
      heading: "Story",
      proposedContent: "Accepted first.",
      reviewerComment: "Accepted Story.",
      sectionId: "user_story" as const,
      status: "Polished" as const,
      updatedAt: "2026-07-09T00:01:00.000Z"
    },
    {
      currentContent: "",
      heading: "Context",
      proposedContent: "Rejected context.",
      reviewerComment: "Rejected Context.",
      sectionId: "problem" as const,
      status: "Raw" as const,
      updatedAt: "2026-07-09T00:02:00.000Z"
    },
    {
      currentContent: "",
      heading: "Scope",
      proposedContent: "Accepted remaining scope.",
      reviewerComment: null,
      sectionId: "scope" as const,
      status: "Raw" as const,
      updatedAt: "2026-07-09T00:00:00.000Z"
    }
  ],
  status: "Pending" as const,
  summary: "Review proposed Jira description changes.",
  taskId: "task-1",
  title: "AI description proposal",
  updatedAt: "2026-07-09T00:02:00.000Z",
  userComment: null
};

const completeStoryDescription = `## Historia de usuario

Como usuario, quiero claridad.

## Contexto

Hay contexto suficiente.

## Alcance

Incluye el flujo principal.

## Criterios de aceptacion

- Cumple el resultado esperado.

## Entregable mínimo

- Cambio verificable.

## Checklist antes de Review

- Revisar en build.`;

function taskWithDescription(descriptionStatus: LocalTask["descriptionStatus"], description: string): LocalTask {
  return {
    id: "task-1",
    project: "STT",
    area: "Programación",
    title: "Resolver problema timer",
    priority: "Medium",
    issueType: "Story",
    syncStatus: "Pending",
    descriptionStatus,
    language: "Spanish",
    description
  };
}

describe("dedupeProposalLogEntries", () => {
  it("shows one visible proposal log entry per proposal", () => {
    const duplicate = {
      id: "log-1",
      taskId: "task-1",
      proposalId: "proposal-1",
      eventType: "description.proposal.section_updated",
      title: "AI description proposal",
      summary: "Review proposed Jira description changes.",
      status: "Pending" as const,
      provider: "OpenAI",
      model: "gpt-4.1",
      userComment: "Accepted Context.",
      detail: { sectionId: "context_impact", applyToTaskDescription: true, polishedSectionCount: 1 },
      occurredAt: "2026-07-07T10:00:00Z"
    };

    expect(
      dedupeProposalLogEntries([
        duplicate,
        {
          ...duplicate,
          id: "log-2",
          occurredAt: "2026-07-07T10:01:00Z",
          detail: { polishedSectionCount: 1, applyToTaskDescription: true, sectionId: "context_impact" }
        },
        {
          ...duplicate,
          id: "log-3",
          occurredAt: "2026-07-07T10:02:00Z",
          status: "Accepted",
          eventType: "description.proposal.status_changed",
          userComment: "Accepted remaining proposal sections."
        }
      ]).map((entry) => entry.id)
    ).toEqual(["log-3"]);
  });
});
