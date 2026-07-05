import { Check, ChevronDown, ChevronLeft, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, FeedbackNote, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { getCredentialDraftControls, type CredentialDraftTestStatus } from "../../lib/domain";
import type { AiProvider, AppSettings, CredentialConnectionTestResult } from "../../lib/types";

type AiProviderSetupStep = "provider" | "key" | "model";

type SupportedAiProvider = Exclude<AiProvider, "None">;

const aiProviderSetupSteps: Array<{ id: AiProviderSetupStep; label: string }> = [
  { id: "provider", label: "Provider" },
  { id: "key", label: "API key" },
  { id: "model", label: "Model" }
];

export const aiProviderOptions: Array<{ label: string; value: SupportedAiProvider }> = [
  { label: "OpenAI", value: "OpenAI" },
  { label: "Claude", value: "Claude" },
  { label: "Gemini", value: "Gemini" }
];

export const defaultAiProviderModels: Record<SupportedAiProvider, string> = {
  OpenAI: "gpt-4.1",
  Claude: "claude-sonnet-4-20250514",
  Gemini: "gemini-2.5-flash"
};

export const availableAiProviderModels: Record<SupportedAiProvider, string[]> = {
  OpenAI: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
  Claude: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
  Gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"]
};

const aiProviderKeyLabels: Record<SupportedAiProvider, string> = {
  OpenAI: "OpenAI API key",
  Claude: "Claude API key",
  Gemini: "Gemini API key"
};

const aiProviderKeyPlaceholders: Record<SupportedAiProvider, string> = {
  OpenAI: "sk-...",
  Claude: "sk-ant-...",
  Gemini: "AIza..."
};

export function AiProviderSetupGuide({
  settings,
  hasAiProviderApiKey,
  aiCredentialMessage,
  isTestingAiProviderConnection,
  onChange,
  onClose,
  onDeleteAiProviderApiKey,
  onOpenAiProviderApiKeys,
  onSaveAiProviderApiKey,
  onListAiProviderModels,
  onTestAiProviderApiKey,
  onTestAiProviderConnection
}: {
  settings: AppSettings;
  hasAiProviderApiKey: boolean;
  aiCredentialMessage: string | null;
  isTestingAiProviderConnection: boolean;
  onChange: (settings: Partial<AppSettings>) => Promise<boolean>;
  onClose: () => void;
  onDeleteAiProviderApiKey: () => void;
  onOpenAiProviderApiKeys: () => void;
  onSaveAiProviderApiKey: (apiKey: string) => Promise<boolean>;
  onListAiProviderModels: (aiProvider: AppSettings["aiProvider"], apiKey?: string) => Promise<string[]>;
  onTestAiProviderApiKey: (apiKey: string) => Promise<CredentialConnectionTestResult>;
  onTestAiProviderConnection: () => Promise<CredentialConnectionTestResult>;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const apiKeyDraftRef = useRef("");
  const initialProvider = settings.aiProvider === "None" ? "OpenAI" : settings.aiProvider;
  const [step, setStep] = useState<AiProviderSetupStep>("provider");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [keyDraftTestStatus, setKeyDraftTestStatus] = useState<CredentialDraftTestStatus>("idle");
  const [connectionTestFeedback, setConnectionTestFeedback] = useState<CredentialConnectionTestResult | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelLoadStatus, setModelLoadStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [modelLoadMessage, setModelLoadMessage] = useState<string | null>(null);
  const selectedProvider = settings.aiProvider === "None" ? initialProvider : settings.aiProvider;
  const selectedModel = settings.aiModel || defaultAiProviderModels[selectedProvider];
  const currentStepIndex = aiProviderSetupSteps.findIndex((candidate) => candidate.id === step);
  const visibleModelOptions = mergeModelOptions(
    modelOptions.length ? modelOptions : availableAiProviderModels[selectedProvider],
    selectedModel
  );
  const controls = getCredentialDraftControls({
    hasConnectionSettings: true,
    hasSavedCredential: hasAiProviderApiKey,
    isTestingConnection: isTestingAiProviderConnection,
    keyDraft: apiKeyDraft,
    keyTestStatus: keyDraftTestStatus
  });
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef
  });

  useEffect(() => {
    if (!apiKeyDraft) return;
    setKeyDraftTestStatus("idle");
  }, [settings.aiProvider, apiKeyDraft]);

  function updateApiKeyDraft(value: string) {
    apiKeyDraftRef.current = value;
    setApiKeyDraft(value);
    setKeyDraftTestStatus("idle");
    setConnectionTestFeedback(null);
  }

  async function selectProvider(aiProvider: SupportedAiProvider) {
    updateApiKeyDraft("");
    setConnectionTestFeedback(null);
    setModelOptions([]);
    setModelLoadStatus("idle");
    setModelLoadMessage(null);
    await onChange({ aiProvider, aiModel: defaultAiProviderModels[aiProvider] });
  }

  async function continueFromProvider() {
    if (settings.aiProvider === "None") {
      await selectProvider(selectedProvider);
    }
    setStep("key");
  }

  function moveBack() {
    if (step === "model") {
      setStep("key");
      return;
    }
    if (step === "key") {
      setStep("provider");
    }
  }

  async function selectModel(aiModel: string) {
    await onChange({ aiProvider: selectedProvider, aiModel });
  }

  async function openModelStep() {
    setStep("model");
    await loadModelOptions();
  }

  async function loadModelOptions() {
    setModelLoadStatus("loading");
    setModelLoadMessage(null);
    try {
      const loadedModels = await onListAiProviderModels(selectedProvider, apiKeyDraft.trim() || undefined);
      const nextModels = mergeModelOptions(
        loadedModels.length ? loadedModels : availableAiProviderModels[selectedProvider],
        selectedModel
      );
      setModelOptions(nextModels);
      setModelLoadStatus("loaded");
      setModelLoadMessage(
        loadedModels.length
          ? `${nextModels.length} ${selectedProvider} models loaded.`
          : `Using built-in ${selectedProvider} model options.`
      );
    } catch (error) {
      const fallbackModels = mergeModelOptions(availableAiProviderModels[selectedProvider], selectedModel);
      setModelOptions(fallbackModels);
      setModelLoadStatus("failed");
      setModelLoadMessage(error instanceof Error ? error.message : `Could not load ${selectedProvider} models.`);
    }
  }

  async function testConnection() {
    if (!controls.canTestConnection) return;
    const apiKeyUnderTest = apiKeyDraft;
    setKeyDraftTestStatus("testing");
    setConnectionTestFeedback({ ok: true, message: apiKeyUnderTest ? "Testing this key without saving it." : `Testing saved ${selectedProvider} connection.` });
    const result = apiKeyUnderTest ? await onTestAiProviderApiKey(apiKeyUnderTest) : await onTestAiProviderConnection();
    if (apiKeyDraftRef.current !== apiKeyUnderTest) return;
    setKeyDraftTestStatus(result.ok ? "success" : "failed");
    setConnectionTestFeedback(result);
  }

  async function saveApiKey() {
    if (!controls.canSaveDraft) return;
    const saved = await onSaveAiProviderApiKey(apiKeyDraft);
    if (!saved) return;
    updateApiKeyDraft("");
    setKeyDraftTestStatus("idle");
    setConnectionTestFeedback(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(9,30,66,0.54)] px-4"
      {...overlay.backdropProps}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose();
      }}
    >
      <section
        ref={surfaceRef}
        className="flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded border border-[#c1c7d0] bg-white shadow-2xl"
        {...overlay.surfaceProps}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <PanelHeader title="Set AI Provider" subtitle="Choose a provider, save a tested API key, then select the model." onClose={onClose} />
        <div className="border-b border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <div className="grid grid-cols-3 gap-2">
            {aiProviderSetupSteps.map((candidate, index) => (
              <button
                className={`h-8 rounded border px-2 text-xs font-medium ${
                  candidate.id === step
                    ? "border-[#0052cc] bg-[#deebff] text-[#0747a6]"
                    : index < currentStepIndex
                      ? "border-[#abf5d1] bg-[#e3fcef] text-[#006644]"
                      : "border-[#dfe1e6] bg-white text-[#6b778c]"
                }`}
                key={candidate.id}
                onClick={() => {
                  if (candidate.id === "model") {
                    void openModelStep();
                    return;
                  }
                  setStep(candidate.id);
                }}
                type="button"
              >
                {index + 1}. {candidate.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-[360px] flex-1 overflow-y-auto p-6">
          {step === "provider" ? (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#172b4d]">Provider</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#6b778c]">
                  Choose the AI provider for Assisted Description and JQL drafting. OpenAI is the primary Personal v1 path.
                </p>
              </div>
              <GuideSelect
                label="AI provider"
                value={selectedProvider}
                options={aiProviderOptions}
                onChange={(value) => {
                  void selectProvider(value as SupportedAiProvider);
                }}
              />
              <div className="mt-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="text-sm font-semibold text-[#172b4d]">Selected setup</div>
                <div className="mt-2 grid gap-2 text-sm text-[#172b4d] sm:grid-cols-2">
                  <div><span className="font-medium text-[#6b778c]">Provider:</span> {selectedProvider}</div>
                  <div><span className="font-medium text-[#6b778c]">Default model:</span> {defaultAiProviderModels[selectedProvider]}</div>
                </div>
              </div>
            </div>
          ) : null}
          {step === "key" ? (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#172b4d]">{aiProviderKeyLabels[selectedProvider]}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#6b778c]">
                    Test the new key before saving it. Keys stay in the OS credential store and are excluded from SQLite and backups.
                  </p>
                </div>
                <Button className="settings-button-secondary w-full justify-center sm:w-auto sm:shrink-0" icon={<ExternalLink size={13} />} variant="secondary" onClick={onOpenAiProviderApiKeys}>
                  Manage key
                </Button>
              </div>
              <div className="mb-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#172b4d]">{hasAiProviderApiKey ? "Credential saved" : "No credential saved"}</div>
                    <p className="text-xs leading-relaxed text-[#6b778c]">{selectedProvider} keys stay outside SQLite and backups.</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${hasAiProviderApiKey ? "bg-[#e3fcef] text-[#006644]" : "bg-[#fff7d6] text-[#7f5f01]"}`}>
                    {hasAiProviderApiKey ? "Saved" : "Missing"}
                  </span>
                </div>
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-[#6b778c]">New API key</span>
                <input
                  className="secret-input h-9 w-full rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
                  placeholder={hasAiProviderApiKey ? "Enter a new key to replace it" : aiProviderKeyPlaceholders[selectedProvider]}
                  type="text"
                  value={apiKeyDraft}
                  onChange={(event) => updateApiKeyDraft(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button className="settings-button-test" disabled={!controls.canTestConnection} icon={isTestingAiProviderConnection ? <LoadingOrb size="xs" /> : <KeyRound size={14} />} variant="secondary" onClick={testConnection}>
                  {isTestingAiProviderConnection ? "Testing..." : "Test connection"}
                </Button>
                <Button className="settings-button-primary" disabled={!controls.canSaveDraft} icon={<KeyRound size={14} />} variant="secondary" onClick={saveApiKey}>
                  Save key
                </Button>
                <Button className="settings-button-danger" disabled={!hasAiProviderApiKey} icon={<Trash2 size={14} />} variant="secondary" onClick={onDeleteAiProviderApiKey}>
                  Remove key
                </Button>
              </div>
              {apiKeyDraft || connectionTestFeedback ? (
                <FeedbackNote className="mt-4" variant={aiProviderConnectionFeedbackVariant(connectionTestFeedback, keyDraftTestStatus, controls.hasConnectionSettings)}>
                  {aiProviderConnectionFeedbackMessage(connectionTestFeedback, keyDraftTestStatus, controls.hasConnectionSettings, Boolean(apiKeyDraft))}
                </FeedbackNote>
              ) : null}
              {aiCredentialMessage ? (
                <FeedbackNote className="mt-4" variant={aiCredentialMessageVariant(aiCredentialMessage)}>{aiCredentialMessage}</FeedbackNote>
              ) : null}
            </div>
          ) : null}
          {step === "model" ? (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#172b4d]">Model</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#6b778c]">
                  Choose the model used by {selectedProvider}. The default stays selected unless you change it.
                </p>
              </div>
              <GuideSelect
                label={`${selectedProvider} model`}
                value={selectedModel}
                options={visibleModelOptions.map((model) => ({ label: model, value: model }))}
                onChange={(value) => {
                  void selectModel(value);
                }}
              />
              {modelLoadStatus === "loading" ? (
                <FeedbackNote className="mt-4" variant="info">
                  Loading {selectedProvider} models...
                </FeedbackNote>
              ) : null}
              {modelLoadMessage && modelLoadStatus !== "loading" ? (
                <FeedbackNote className="mt-4" variant={modelLoadStatus === "failed" ? "warning" : "success"}>
                  {modelLoadMessage}
                </FeedbackNote>
              ) : null}
              <div className="mt-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="text-sm font-semibold text-[#172b4d]">Final setup</div>
                <div className="mt-2 grid gap-2 text-sm text-[#172b4d] sm:grid-cols-3">
                  <div><span className="font-medium text-[#6b778c]">Provider:</span> {selectedProvider}</div>
                  <div><span className="font-medium text-[#6b778c]">Credential:</span> {hasAiProviderApiKey ? "Saved" : "Missing"}</div>
                  <div><span className="font-medium text-[#6b778c]">Model:</span> {selectedModel}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <Button disabled={currentStepIndex === 0} icon={<ChevronLeft size={14} />} variant="secondary" onClick={moveBack}>
            Back
          </Button>
          {step === "provider" ? (
            <Button className="settings-button-primary" onClick={() => void continueFromProvider()}>
              Continue
            </Button>
          ) : step === "key" ? (
            <Button className="settings-button-primary" onClick={() => void openModelStep()}>
              Continue
            </Button>
          ) : (
            <Button className="settings-button-primary" icon={<Check size={14} />} onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function mergeModelOptions(models: string[], selectedModel: string): string[] {
  const mergedModels = [selectedModel, ...models]
    .map((model) => model.trim())
    .filter(Boolean);
  return Array.from(new Set(mergedModels));
}

function GuideSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative">
      <div className="mb-2 block text-xs font-medium text-[#6b778c]">{label}</div>
      <button
        className="flex h-10 w-full items-center justify-between gap-2 rounded border border-[#c1c7d0] bg-white px-3 text-left text-sm text-[#172b4d] outline-none hover:bg-[#f4f5f7] focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="app-select-menu absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded border py-1 text-sm shadow-xl">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className="app-select-option flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              type="button"
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function aiProviderConnectionFeedbackMessage(
  feedback: CredentialConnectionTestResult | null,
  status: CredentialDraftTestStatus,
  hasConnectionSettings: boolean,
  hasApiKeyDraft: boolean
): string {
  if (feedback && status === "testing") return feedback.message;
  if (feedback && !feedback.ok) return feedback.message;
  if (feedback && feedback.ok && !hasApiKeyDraft) return feedback.message;
  return aiProviderKeyDraftStatusMessage(status, hasConnectionSettings);
}

function aiProviderConnectionFeedbackVariant(
  feedback: CredentialConnectionTestResult | null,
  status: CredentialDraftTestStatus,
  hasConnectionSettings: boolean
) {
  if (feedback && status === "testing") return "info";
  if (feedback && !feedback.ok) return "error";
  return aiProviderKeyDraftStatusVariant(status, hasConnectionSettings);
}

function aiProviderKeyDraftStatusMessage(status: CredentialDraftTestStatus, hasConnectionSettings: boolean): string {
  if (!hasConnectionSettings) return "Select an AI provider before testing this key.";
  if (status === "success") return "This key passed Test connection and can be saved.";
  if (status === "failed") return "Update this key, then test again before saving.";
  if (status === "testing") return "Testing this key without saving it.";
  return "Test this key before saving it.";
}

function aiProviderKeyDraftStatusVariant(status: CredentialDraftTestStatus, hasConnectionSettings: boolean) {
  if (!hasConnectionSettings) return "warning";
  if (status === "success") return "success";
  if (status === "failed") return "error";
  if (status === "testing") return "info";
  return "warning";
}

function aiCredentialMessageVariant(message: string) {
  if (/saved|removed/i.test(message)) return "success";
  if (/select|empty/i.test(message)) return "warning";
  return "error";
}
