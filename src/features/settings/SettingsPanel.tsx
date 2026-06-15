import { Bot, Check, ChevronDown, Download, ExternalLink, KeyRound, Settings, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, DetailBlock, LoadingOrb, PanelHeader, SegmentedControl } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { getCredentialDraftControls, type CredentialDraftTestStatus } from "../../lib/domain";
import type { AiProvider, AppSettings, CredentialConnectionTestResult, JiraConnectionTestResult, ThemeMode } from "../../lib/types";

const aiProviderOptions: Array<{ label: string; value: AiProvider }> = [
  { label: "OpenAI", value: "OpenAI" },
  { label: "Claude", value: "Claude" },
  { label: "Gemini", value: "Gemini" },
  { label: "None", value: "None" }
];

const aiProviderKeyLabels: Record<Exclude<AiProvider, "None">, string> = {
  OpenAI: "OpenAI API key",
  Claude: "Claude API key",
  Gemini: "Gemini API key"
};

const aiProviderKeyPlaceholders: Record<Exclude<AiProvider, "None">, string> = {
  OpenAI: "sk-...",
  Claude: "sk-ant-...",
  Gemini: "AIza..."
};

const defaultAiProviderModels: Record<Exclude<AiProvider, "None">, string> = {
  OpenAI: "gpt-4.1",
  Claude: "claude-sonnet-4-20250514",
  Gemini: "gemini-2.5-flash"
};

export function SettingsPanel({
  settings,
  hasJiraApiToken,
  hasAiProviderApiKey,
  jiraCredentialMessage,
  aiCredentialMessage,
  isTestingJiraConnection,
  isTestingAiProviderConnection,
  onChange,
  onSaveJiraApiToken,
  onDeleteJiraApiToken,
  onSaveAiProviderApiKey,
  onDeleteAiProviderApiKey,
  onTestAiProviderConnection,
  onTestAiProviderApiKey,
  onTestJiraConnection,
  onTestJiraApiToken,
  onOpenJiraApiTokens,
  onOpenAiProviderApiKeys,
  onExportBackup,
  onImportBackup,
  onClose
}: {
  settings: AppSettings;
  hasJiraApiToken: boolean;
  hasAiProviderApiKey: boolean;
  jiraCredentialMessage: string | null;
  aiCredentialMessage: string | null;
  isTestingJiraConnection: boolean;
  isTestingAiProviderConnection: boolean;
  onChange: (settings: Partial<AppSettings>) => Promise<boolean>;
  onSaveJiraApiToken: (token: string) => Promise<boolean>;
  onDeleteJiraApiToken: () => void;
  onSaveAiProviderApiKey: (apiKey: string) => Promise<boolean>;
  onDeleteAiProviderApiKey: () => void;
  onTestAiProviderConnection: () => Promise<CredentialConnectionTestResult>;
  onTestAiProviderApiKey: (apiKey: string) => Promise<CredentialConnectionTestResult>;
  onTestJiraConnection: () => Promise<JiraConnectionTestResult>;
  onTestJiraApiToken: (token: string) => Promise<JiraConnectionTestResult>;
  onOpenJiraApiTokens: () => void;
  onOpenAiProviderApiKeys: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const jiraApiTokenDraftRef = useRef("");
  const aiProviderApiKeyDraftRef = useRef("");
  const [jiraApiTokenDraft, setJiraApiTokenDraft] = useState("");
  const [jiraTokenDraftTestStatus, setJiraTokenDraftTestStatus] = useState<CredentialDraftTestStatus>("idle");
  const [jiraSiteUrlDraft, setJiraSiteUrlDraft] = useState(settings.jiraSiteUrl);
  const [jiraSiteUrlDirty, setJiraSiteUrlDirty] = useState(false);
  const [jiraSiteUrlStatus, setJiraSiteUrlStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [aiProviderApiKeyDraft, setAiProviderApiKeyDraft] = useState("");
  const [aiProviderKeyDraftTestStatus, setAiProviderKeyDraftTestStatus] = useState<CredentialDraftTestStatus>("idle");
  const selectedAiProvider = settings.aiProvider === "None" ? "OpenAI" : settings.aiProvider;
  const isAiProviderSelected = settings.aiProvider !== "None";
  const selectedAiProviderKeyLabel = settings.aiProvider === "None" ? "AI provider API key" : aiProviderKeyLabels[selectedAiProvider];
  const selectedAiProviderPlaceholder = settings.aiProvider === "None"
    ? "Select an AI provider"
    : hasAiProviderApiKey
    ? "Enter a new key to replace it"
    : aiProviderKeyPlaceholders[selectedAiProvider];
  const jiraTokenDraftControls = getCredentialDraftControls({
    hasConnectionSettings: Boolean(settings.jiraSiteUrl.trim() && settings.jiraAccountEmail.trim()),
    hasSavedCredential: hasJiraApiToken,
    isTestingConnection: isTestingJiraConnection,
    keyDraft: jiraApiTokenDraft,
    keyTestStatus: jiraTokenDraftTestStatus
  });
  const aiProviderKeyDraftControls = getCredentialDraftControls({
    hasConnectionSettings: isAiProviderSelected,
    hasSavedCredential: hasAiProviderApiKey,
    isTestingConnection: isTestingAiProviderConnection,
    keyDraft: aiProviderApiKeyDraft,
    keyTestStatus: aiProviderKeyDraftTestStatus
  });

  useAppOverlay({
    layer: appOverlayLayers.sidePanel,
    onDismiss: onClose,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef: panelRef
  });

  useEffect(() => {
    if (jiraSiteUrlDirty) return;
    setJiraSiteUrlDraft(settings.jiraSiteUrl);
  }, [jiraSiteUrlDirty, settings.jiraSiteUrl]);

  function updateJiraSiteUrlDraft(value: string) {
    setJiraSiteUrlDraft(value);
    setJiraSiteUrlDirty(value !== settings.jiraSiteUrl);
    setJiraSiteUrlStatus("idle");
  }

  async function saveJiraSiteUrlDraft() {
    const nextSiteUrl = jiraSiteUrlDraft.trim();
    if (!nextSiteUrl || nextSiteUrl === settings.jiraSiteUrl) {
      setJiraSiteUrlDraft(settings.jiraSiteUrl);
      setJiraSiteUrlDirty(false);
      setJiraSiteUrlStatus("idle");
      return;
    }

    setJiraSiteUrlStatus("saving");
    const saved = await onChange({ jiraSiteUrl: nextSiteUrl });
    if (saved) {
      setJiraSiteUrlDirty(false);
      setJiraSiteUrlStatus("saved");
      return;
    }

    setJiraSiteUrlStatus("failed");
  }

  function updateJiraApiTokenDraft(value: string) {
    jiraApiTokenDraftRef.current = value;
    setJiraApiTokenDraft(value);
    setJiraTokenDraftTestStatus("idle");
  }

  function updateAiProviderApiKeyDraft(value: string) {
    aiProviderApiKeyDraftRef.current = value;
    setAiProviderApiKeyDraft(value);
    setAiProviderKeyDraftTestStatus("idle");
  }

  function changeAiProvider(aiProvider: AiProvider) {
    updateAiProviderApiKeyDraft("");
    setAiProviderKeyDraftTestStatus("idle");
    onChange({
      aiProvider,
      aiModel: aiProvider === "None" ? "" : defaultAiProviderModels[aiProvider]
    });
  }

  async function testJiraTokenConnection() {
    if (!jiraTokenDraftControls.canTestConnection) return;

    const tokenUnderTest = jiraApiTokenDraft;
    setJiraTokenDraftTestStatus("testing");
    const result = tokenUnderTest ? await onTestJiraApiToken(tokenUnderTest) : await onTestJiraConnection();
    if (jiraApiTokenDraftRef.current !== tokenUnderTest) return;
    setJiraTokenDraftTestStatus(result.ok ? "success" : "failed");
  }

  async function testAiProviderKeyConnection() {
    if (!aiProviderKeyDraftControls.canTestConnection) return;

    const apiKeyUnderTest = aiProviderApiKeyDraft;
    setAiProviderKeyDraftTestStatus("testing");
    const result = apiKeyUnderTest ? await onTestAiProviderApiKey(apiKeyUnderTest) : await onTestAiProviderConnection();
    if (aiProviderApiKeyDraftRef.current !== apiKeyUnderTest) return;
    setAiProviderKeyDraftTestStatus(result.ok ? "success" : "failed");
  }

  async function saveJiraToken() {
    if (!jiraTokenDraftControls.canSaveDraft) return;

    const saved = await onSaveJiraApiToken(jiraApiTokenDraft);
    if (saved) {
      updateJiraApiTokenDraft("");
      setJiraTokenDraftTestStatus("idle");
    }
  }

  async function saveAiProviderKey() {
    if (!aiProviderKeyDraftControls.canSaveDraft) return;

    const saved = await onSaveAiProviderApiKey(aiProviderApiKeyDraft);
    if (saved) {
      updateAiProviderApiKeyDraft("");
      setAiProviderKeyDraftTestStatus("idle");
    }
  }

  useEffect(() => {
    if (!jiraApiTokenDraft) return;
    setJiraTokenDraftTestStatus("idle");
  }, [settings.jiraAccountEmail, settings.jiraSiteUrl, jiraApiTokenDraft]);

  useEffect(() => {
    if (!aiProviderApiKeyDraft) return;
    setAiProviderKeyDraftTestStatus("idle");
  }, [settings.aiProvider, aiProviderApiKeyDraft]);

  return (
    <aside ref={panelRef} className="fixed right-0 top-0 z-30 flex h-screen w-[420px] flex-col overscroll-contain border-l border-[#dfe1e6] bg-white shadow-xl">
      <PanelHeader title="Settings" subtitle="Local configuration without secrets in backups" onClose={onClose} />
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <DetailBlock icon={<Settings size={15} />} title="Appearance">
          <div className="mb-2 text-xs font-medium text-[#6b778c]">Theme</div>
          <SegmentedControl
            value={settings.themeMode}
            options={[
              { label: "Dark", value: "dark" },
              { label: "Light", value: "light" },
              { label: "System", value: "system" }
            ]}
            onChange={(value) => onChange({ themeMode: value as ThemeMode })}
          />
        </DetailBlock>

        <DetailBlock icon={<KeyRound size={15} />} title="Jira connection">
          <div className="mb-3">
            <div className="mb-1 text-xs font-medium text-[#6b778c]">Site URL</div>
            <div className="flex gap-2">
              <input
                className="h-9 min-w-0 flex-1 rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
                placeholder="https://your-site.atlassian.net"
                type="text"
                value={jiraSiteUrlDraft}
                onChange={(event) => updateJiraSiteUrlDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <Button
                className="settings-button-primary"
                disabled={!jiraSiteUrlDirty || jiraSiteUrlStatus === "saving"}
                variant="secondary"
                onClick={saveJiraSiteUrlDraft}
              >
                {jiraSiteUrlStatus === "saving" ? "Saving..." : "Save"}
              </Button>
            </div>
            {jiraSiteUrlStatus === "failed" ? (
              <p className="mt-1 text-xs text-[#bf2600]">Use a standard Atlassian Cloud site root, for example https://your-site.atlassian.net.</p>
            ) : jiraSiteUrlStatus === "saved" ? (
              <p className="mt-1 text-xs text-[#006644]">Site URL saved.</p>
            ) : (
              <p className="mt-1 text-xs text-[#6b778c]">Save a standard Atlassian Cloud site root. Paths, ports, credentials, and custom domains are rejected.</p>
            )}
          </div>
          <SettingsInput
            label="Account email"
            placeholder="name@example.com"
            value={settings.jiraAccountEmail}
            onChange={(jiraAccountEmail) => onChange({ jiraAccountEmail })}
          />
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            Jira uses API tokens for now. Tokens are never stored in SQLite or backups. The backend stores the token in the OS credential store.
          </p>
          <div className="mt-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <SettingsInput
              label="Jira project key for creation"
              placeholder="JTFTEST"
              value={settings.jiraCreationProjectKey}
              onChange={(jiraCreationProjectKey) => onChange({ jiraCreationProjectKey: jiraCreationProjectKey.toUpperCase() })}
            />
            <p className="text-xs leading-relaxed text-[#6b778c]">
              Every Jira upload uses this single project key for the whole tray. Internal app projects remain preparation categories.
            </p>
          </div>
          <div className="mt-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[#6b778c]">API token</div>
                <div className="text-sm font-medium text-[#172b4d]">
                  {hasJiraApiToken ? "Credential saved" : "No credential saved"}
                </div>
                <button
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#0052cc] hover:underline"
                  onClick={onOpenJiraApiTokens}
                  type="button"
                >
                  Create or manage token
                  <ExternalLink size={11} />
                </button>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-medium ${hasJiraApiToken ? "bg-[#e3fcef] text-[#006644]" : "bg-[#f4f5f7] text-[#6b778c]"}`}>
                {hasJiraApiToken ? "Saved" : "Missing"}
              </span>
            </div>
            <SettingsInput
              label="New API token"
              masked
              placeholder={hasJiraApiToken ? "Enter a new token to replace it" : "Paste API token"}
              value={jiraApiTokenDraft}
              onChange={updateJiraApiTokenDraft}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="settings-button-primary"
                disabled={!jiraTokenDraftControls.canSaveDraft}
                variant="secondary"
                onClick={saveJiraToken}
              >
                Save key
              </Button>
              <Button
                className="settings-button-danger"
                disabled={!hasJiraApiToken}
                variant="secondary"
                onClick={onDeleteJiraApiToken}
              >
                Remove key
              </Button>
              <Button
                className="settings-button-test col-span-2 min-w-0 whitespace-nowrap"
                disabled={!jiraTokenDraftControls.canTestConnection}
                icon={jiraTokenDraftTestStatus === "testing" ? <LoadingOrb size="xs" /> : undefined}
                variant="secondary"
                onClick={testJiraTokenConnection}
              >
                {jiraTokenDraftTestStatus === "testing" ? "Testing..." : "Test connection"}
              </Button>
            </div>
            {jiraApiTokenDraft ? (
              <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
                {jiraTokenDraftStatusMessage(jiraTokenDraftTestStatus, jiraTokenDraftControls.hasConnectionSettings)}
              </p>
            ) : null}
            {jiraCredentialMessage ? (
              <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">{jiraCredentialMessage}</p>
            ) : null}
          </div>
        </DetailBlock>

        <DetailBlock icon={<Bot size={15} />} title="AI provider">
          <SettingsSelect
            label="Provider"
            value={settings.aiProvider}
            options={aiProviderOptions}
            onChange={(aiProvider) => changeAiProvider(aiProvider as AiProvider)}
          />
          <div className="mt-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[#6b778c]">{selectedAiProviderKeyLabel}</div>
                <div className="text-sm font-medium text-[#172b4d]">
                  {settings.aiProvider === "None"
                    ? "No AI provider selected"
                    : hasAiProviderApiKey
                      ? "Credential saved"
                      : "No credential saved"}
                </div>
                {settings.aiProvider !== "None" ? (
                  <button
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#0052cc] hover:underline"
                    onClick={onOpenAiProviderApiKeys}
                    type="button"
                  >
                    Create or manage key
                    <ExternalLink size={11} />
                  </button>
                ) : null}
              </div>
              <span className={`rounded px-2 py-1 text-xs font-medium ${isAiProviderSelected && hasAiProviderApiKey ? "bg-[#e3fcef] text-[#006644]" : "bg-[#f4f5f7] text-[#6b778c]"}`}>
                {settings.aiProvider === "None" ? "Off" : hasAiProviderApiKey ? "Saved" : "Missing"}
              </span>
            </div>
            <SettingsInput
              label="New API key"
              masked
              disabled={!isAiProviderSelected}
              placeholder={selectedAiProviderPlaceholder}
              value={aiProviderApiKeyDraft}
              onChange={updateAiProviderApiKeyDraft}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="settings-button-primary min-w-0 whitespace-nowrap"
                disabled={!isAiProviderSelected || !aiProviderKeyDraftControls.canSaveDraft}
                variant="secondary"
                onClick={saveAiProviderKey}
              >
                Save key
              </Button>
              <Button
                className="settings-button-danger min-w-0 whitespace-nowrap"
                disabled={!isAiProviderSelected || !hasAiProviderApiKey}
                variant="secondary"
                onClick={onDeleteAiProviderApiKey}
              >
                Remove key
              </Button>
              <Button
                className="settings-button-test col-span-2 min-w-0 whitespace-nowrap"
                disabled={!isAiProviderSelected || !aiProviderKeyDraftControls.canTestConnection}
                icon={isTestingAiProviderConnection ? <LoadingOrb size="xs" /> : undefined}
                variant="secondary"
                onClick={testAiProviderKeyConnection}
              >
                {isTestingAiProviderConnection ? "Testing..." : "Test connection"}
              </Button>
            </div>
            {aiProviderApiKeyDraft ? (
              <p className="mt-2 break-words text-xs leading-relaxed text-[#6b778c]">
                {aiProviderKeyDraftStatusMessage(aiProviderKeyDraftTestStatus, aiProviderKeyDraftControls.hasConnectionSettings)}
              </p>
            ) : null}
            {aiCredentialMessage ? (
              <p className="mt-2 break-words text-xs leading-relaxed text-[#6b778c]">{aiCredentialMessage}</p>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            AI keys follow the same secret boundary as Jira credentials and are never included in backups.
          </p>
        </DetailBlock>

        <DetailBlock icon={<Download size={15} />} title="Backup and restore">
          <p className="mb-3 text-sm text-[#6b778c]">
            JSON backups include trays, tasks, categories, epic mappings, JQL favorites, settings, and attachment metadata. Secrets are excluded.
          </p>
          <div className="flex gap-2">
            <Button className="settings-button-secondary" variant="secondary" icon={<Download size={14} />} onClick={onExportBackup}>
              Export backup
            </Button>
            <Button className="settings-button-secondary" variant="secondary" icon={<UploadCloud size={14} />} onClick={onImportBackup}>
              Import backup
            </Button>
          </div>
        </DetailBlock>
      </div>
    </aside>
  );
}

function jiraTokenDraftStatusMessage(status: CredentialDraftTestStatus, hasConnectionSettings: boolean): string {
  if (!hasConnectionSettings) return "Add a Jira site URL and account email before testing this token.";
  if (status === "success") return "This key passed Test connection and can be saved.";
  if (status === "failed") return "Update this key or Jira settings, then test again before saving.";
  if (status === "testing") return "Testing this token without saving it.";
  return "Test this key before saving it.";
}

function aiProviderKeyDraftStatusMessage(status: CredentialDraftTestStatus, hasConnectionSettings: boolean): string {
  if (!hasConnectionSettings) return "Select an AI provider before testing this key.";
  if (status === "success") return "This key passed Test connection and can be saved.";
  if (status === "failed") return "Update this key, then test again before saving.";
  if (status === "testing") return "Testing this key without saving it.";
  return "Test this key before saving it.";
}

function SettingsInput({
  label,
  value,
  disabled = false,
  masked = false,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  disabled?: boolean;
  masked?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</span>
      <input
        className={`h-9 w-full rounded border border-[#c1c7d0] bg-white px-2 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] disabled:cursor-not-allowed disabled:bg-[#f4f5f7] disabled:text-[#6b778c] ${masked ? "secret-input" : ""}`}
        disabled={disabled}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SettingsSelect({
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
    <div className="relative mb-3">
      <div className="mb-1 block text-xs font-medium text-[#6b778c]">{label}</div>
      <button
        className="flex h-9 w-full items-center justify-between gap-2 rounded border border-[#c1c7d0] bg-white px-2 text-left text-sm text-[#172b4d] outline-none hover:bg-[#f4f5f7] focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded border border-[#c1c7d0] bg-white py-1 text-sm shadow-xl">
          {options.map((option) => (
            <button
              className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-[#172b4d] hover:bg-[#f4f5f7]"
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
