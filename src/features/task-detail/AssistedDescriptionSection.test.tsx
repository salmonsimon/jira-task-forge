import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DescriptionPromptModal,
  TaskDetailNestedModalShell,
  dedupeProposalLogEntries,
  getAiProviderSetupActionLabel,
  isAiProviderSetupMessage
} from "./AssistedDescriptionSection";

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
    expect(html).toContain("Continue");
    expect(html).not.toContain("Delivery format");
  });

  it("renders only valid mapped delivery formats in the confirmation step", () => {
    const html = renderToStaticMarkup(
      <DescriptionPromptModal
        clarificationQuestions={[]}
        deliveryFormatGate={{
          kind: "needs_confirmation",
          areaDisplayName: "Arquitectura",
          suggestedFormat: "Arquitectura - Propuesta Final",
          options: ["Arquitectura - Brief", "Arquitectura - Propuesta Final"]
        }}
        descriptionContext=""
        descriptionMessage="Confirm the delivery format before generating the description proposal."
        isGeneratingDescription={false}
        onCancel={() => undefined}
        onChange={() => undefined}
        onGenerate={() => undefined}
        onKeyDown={() => undefined}
        onSelectDeliveryFormat={() => undefined}
        selectedDeliveryFormat="Arquitectura - Propuesta Final"
        step="delivery_format"
      />
    );

    expect(html).toContain("Confirm delivery format");
    expect(html).toContain("Delivery format");
    expect(html).toContain("Arquitectura - Propuesta Final");
    expect(html).not.toContain("Formato inventado");
    expect(html).not.toContain("<select");
  });

  it("warns when delivery format cannot be inferred from the provided context", () => {
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

    expect(html).toContain("Could not infer a delivery format from the provided context.");
    expect(html).toContain("Choose delivery format");
    expect(html).toContain("disabled");
  });
});

describe("dedupeProposalLogEntries", () => {
  it("removes duplicate persisted proposal log entries deterministically", () => {
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
          status: "Accepted",
          eventType: "description.proposal.status_changed",
          userComment: "Accepted remaining proposal sections."
        }
      ]).map((entry) => entry.id)
    ).toEqual(["log-1", "log-3"]);
  });
});
