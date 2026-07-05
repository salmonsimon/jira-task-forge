import { Bot, Check, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, FeedbackNote, LoadingOrb, PanelHeader } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { getCredentialDraftControls, type CredentialDraftTestStatus } from "../../lib/domain";
import type { AiProvider, AppSettings, CredentialConnectionTestResult } from "../../lib/types";

type AiProviderSetupStep = "provider" | "key";

type SupportedAiProvider = Exclude<AiProvider, "None">;

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
  onTestAiProviderApiKey: (apiKey: string) => Promise<CredentialConnectionTestResult>;
  onTestAiProviderConnection: () => Promise<CredentialConnectionTestResult>;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const apiKeyDraftRef = useRef("");
  const initialProvider = settings.aiProvider === "None" ? "OpenAI" : settings.aiProvider;
  const [step, setStep] = useState<AiProviderSetupStep>("provider");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [keyDraftTestStatus, setKeyDraftTestStatus] = useState<CredentialDraftTestStatus>("idle");
  const selectedProvider = settings.aiProvider === "None" ? initialProvider : settings.aiProvider;
  const selectedModel = settings.aiModel || defaultAiProviderModels[selectedProvider];
  const controls = getCredentialDraftControls({
    hasConnectionSettings: settings.aiProvider !== "None",
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
  }

  async function selectProvider(aiProvider: SupportedAiProvider) {
    updateApiKeyDraft("");
    await onChange({ aiProvider, aiModel: defaultAiProviderModels[aiProvider] });
  }

  async function testConnection() {
    if (!controls.canTestConnection) return;
    const apiKeyUnderTest = apiKeyDraft;
    setKeyDraftTestStatus("testing");
    const result = apiKeyUnderTest ? await onTestAiProviderApiKey(apiKeyUnderTest) : await onTestAiProviderConnection();
    if (apiKeyDraftRef.current !== apiKeyUnderTest) return;
    setKeyDraftTestStatus(result.ok ? "success" : "failed");
  }

  async function saveApiKey() {
    if (!controls.canSaveDraft) return;
    const saved = await onSaveAiProviderApiKey(apiKeyDraft);
    if (!saved) return;
    updateApiKeyDraft("");
    setKeyDraftTestStatus("idle");
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
        <PanelHeader title="Set AI Provider" subtitle="Choose a provider, confirm the default model, then save a tested API key." onClose={onClose} />
        <div className="border-b border-[#dfe1e6] bg-[#f7f8fa] px-5 py-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["provider", "Provider"],
              ["key", "API key"]
            ].map(([id, label], index) => (
              <button
                className={`h-8 rounded border px-2 text-xs font-medium ${
                  id === step
                    ? "border-[#0052cc] bg-[#deebff] text-[#0747a6]"
                    : index === 0 && settings.aiProvider !== "None"
                      ? "border-[#abf5d1] bg-[#e3fcef] text-[#006644]"
                      : "border-[#dfe1e6] bg-white text-[#6b778c]"
                }`}
                key={id}
                onClick={() => setStep(id as AiProviderSetupStep)}
                type="button"
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-[360px] flex-1 overflow-y-auto p-6">
          {step === "provider" ? (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-[#172b4d]">Provider and model</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#6b778c]">
                  OpenAI is wired for Personal v1. Claude and Gemini keep the same settings shape for later backend support.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {aiProviderOptions.map((option) => {
                  const isSelected = selectedProvider === option.value;
                  const model = defaultAiProviderModels[option.value];
                  return (
                    <button
                      className={`min-h-[118px] rounded border p-3 text-left ${
                        isSelected ? "border-[#0052cc] bg-[#deebff]" : "border-[#dfe1e6] bg-white hover:border-[#4c9aff]"
                      }`}
                      key={option.value}
                      onClick={() => selectProvider(option.value)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#172b4d]">{option.label}</span>
                        {isSelected ? <Check className="text-[#0052cc]" size={16} /> : null}
                      </div>
                      <div className="mt-3 text-xs font-semibold text-[#6b778c]">Recommended model</div>
                      <div className="mt-1 break-words text-sm text-[#172b4d]">{model}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-4">
                <div className="text-sm font-semibold text-[#172b4d]">Selected setup</div>
                <div className="mt-2 grid gap-2 text-sm text-[#172b4d] sm:grid-cols-2">
                  <div><span className="font-medium text-[#6b778c]">Provider:</span> {selectedProvider}</div>
                  <div><span className="font-medium text-[#6b778c]">Model:</span> {selectedModel}</div>
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
                    <p className="text-xs leading-relaxed text-[#6b778c]">{selectedProvider} uses {selectedModel} by default.</p>
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
              {apiKeyDraft ? (
                <FeedbackNote className="mt-4" variant={aiProviderKeyDraftStatusVariant(keyDraftTestStatus, controls.hasConnectionSettings)}>
                  {aiProviderKeyDraftStatusMessage(keyDraftTestStatus, controls.hasConnectionSettings)}
                </FeedbackNote>
              ) : null}
              {aiCredentialMessage ? (
                <FeedbackNote className="mt-4" variant={aiCredentialMessageVariant(aiCredentialMessage)}>{aiCredentialMessage}</FeedbackNote>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-[#dfe1e6] bg-[#f7f8fa] px-5 py-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {step === "provider" ? (
            <Button className="settings-button-primary" icon={<Bot size={14} />} variant="secondary" onClick={() => setStep("key")}>
              Continue to API key
            </Button>
          ) : (
            <Button className="settings-button-primary" variant="secondary" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </section>
    </div>
  );
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
