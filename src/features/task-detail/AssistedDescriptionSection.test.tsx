import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DescriptionPromptModal,
  TaskDetailNestedModalShell,
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
    expect(html).toContain("Description proposal");
    expect(html).toContain("Configure OpenAI");
  });
});

describe("DescriptionPromptModal delivery-format gate", () => {
  it("renders only valid mapped delivery formats before proposal generation", () => {
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
      />
    );

    expect(html).toContain("Delivery format");
    expect(html).toContain("Arquitectura - Brief");
    expect(html).toContain("Arquitectura - Propuesta Final (suggested)");
    expect(html).not.toContain("Formato inventado");
  });
});
