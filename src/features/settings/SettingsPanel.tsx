import { Bot, Check, ChevronDown, Download, KeyRound, Settings, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, DetailBlock, DrawerShell, FeedbackNote, PanelHeader, SegmentedControl } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import type { AiProvider, AppSettings, CredentialConnectionTestResult, JiraConnectionTestResult, JiraProjectOption, NotionCatalogConnectionTestResult, ThemeMode } from "../../lib/types";
import { AiProviderSetupGuide, defaultAiProviderModels } from "./AiProviderSetupGuide";
import { JiraConnectionGuide } from "./JiraConnectionGuide";
import notionMark from "../../assets/notion-mark.png";
import { defaultNotionCatalogUrl, NotionSynchronizationGuide } from "./NotionSynchronizationGuide";

const aiProviderOptions: Array<{ label: string; value: AiProvider }> = [
  { label: "OpenAI", value: "OpenAI" },
  { label: "Claude", value: "Claude" },
  { label: "Gemini", value: "Gemini" },
  { label: "None", value: "None" }
];

export function SettingsPanel({
  settings,
  hasJiraApiToken,
  hasAiProviderApiKey,
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
  onTestJiraApiTokenQuiet,
  onTestJiraConnectionSettings,
  hasNotionIntegrationToken,
  onSaveNotionIntegrationToken,
  onDeleteNotionIntegrationToken,
  onTestNotionCatalogConnection,
  onListJiraProjectsForConnection,
  onOpenJiraApiTokens,
  onOpenNotionDevelopers,
  onOpenAiProviderApiKeys,
  onExportBackup,
  onImportBackup,
  initialGuide,
  onInitialGuideClose,
  onClose
}: {
  settings: AppSettings;
  hasJiraApiToken: boolean;
  hasAiProviderApiKey: boolean;
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
  onTestJiraApiTokenQuiet: (token: string) => Promise<JiraConnectionTestResult>;
  onTestJiraConnectionSettings: (siteUrl: string, accountEmail: string) => Promise<JiraConnectionTestResult>;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onSaveNotionIntegrationToken: (token: string) => Promise<void>;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onTestNotionCatalogConnection: (pageUrlOrId: string) => Promise<NotionCatalogConnectionTestResult>;
  onListJiraProjectsForConnection: (siteUrl: string, accountEmail: string) => Promise<JiraProjectOption[]>;
  onOpenJiraApiTokens: () => void;
  onOpenNotionDevelopers: () => void;
  onOpenAiProviderApiKeys: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  initialGuide?: "notion-synchronization" | "ai-provider" | null;
  onInitialGuideClose?: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [isJiraConnectionGuideOpen, setIsJiraConnectionGuideOpen] = useState(false);
  const [isNotionSynchronizationGuideOpen, setIsNotionSynchronizationGuideOpen] = useState(
    initialGuide === "notion-synchronization"
  );
  const [isAiProviderSetupGuideOpen, setIsAiProviderSetupGuideOpen] = useState(initialGuide === "ai-provider");
  const [hasNotionToken, setHasNotionToken] = useState(false);
  const selectedAiProvider = settings.aiProvider === "None" ? "OpenAI" : settings.aiProvider;
  const isAiProviderSelected = settings.aiProvider !== "None";
  const isJiraConnectionComplete = Boolean(
    settings.jiraSiteUrl.trim() &&
    settings.jiraAccountEmail.trim() &&
    settings.jiraCreationProjectKey.trim() &&
    hasJiraApiToken
  );
  const isNotionSynchronizationConfigured = Boolean(
    settings.catalogSourceMode === "manual" ||
      (settings.catalogSourceMode === "notion" && settings.catalogSourceUrl.trim() && hasNotionToken)
  );
  const overlay = useAppOverlay({
    layer: appOverlayLayers.sidePanel,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef: panelRef
  });

  function changeAiProvider(aiProvider: AiProvider) {
    onChange({
      aiProvider,
      aiModel: aiProvider === "None" ? "" : defaultAiProviderModels[aiProvider]
    });
  }

  function closeNotionSynchronizationGuide() {
    setIsNotionSynchronizationGuideOpen(false);
    if (initialGuide === "notion-synchronization") {
      onInitialGuideClose?.();
    }
  }

  function closeAiProviderSetupGuide() {
    setIsAiProviderSetupGuideOpen(false);
    if (initialGuide === "ai-provider") {
      onInitialGuideClose?.();
    }
  }

  useEffect(() => {
    if (initialGuide === "notion-synchronization") {
      setIsNotionSynchronizationGuideOpen(true);
    }
  }, [initialGuide]);

  useEffect(() => {
    if (initialGuide === "ai-provider") {
      setIsAiProviderSetupGuideOpen(true);
    }
  }, [initialGuide]);

  useEffect(() => {
    let cancelled = false;
    void hasNotionIntegrationToken().then((available) => {
      if (!cancelled) setHasNotionToken(available);
    });
    return () => {
      cancelled = true;
    };
  }, [hasNotionIntegrationToken, isNotionSynchronizationGuideOpen]);

  return (
    <DrawerShell overlay={overlay} surfaceRef={panelRef}>
      {isJiraConnectionGuideOpen ? (
        <JiraConnectionGuide
          settings={settings}
          hasJiraApiToken={hasJiraApiToken}
          isTestingJiraConnection={isTestingJiraConnection}
          onSave={onChange}
          onSaveJiraApiToken={onSaveJiraApiToken}
          onDeleteJiraApiToken={onDeleteJiraApiToken}
          onTestConnection={onTestJiraConnectionSettings}
          onTestJiraApiToken={onTestJiraApiTokenQuiet}
          onListProjects={onListJiraProjectsForConnection}
          onOpenJiraApiTokens={onOpenJiraApiTokens}
          onClose={() => setIsJiraConnectionGuideOpen(false)}
        />
      ) : null}
      {isNotionSynchronizationGuideOpen ? (
        <NotionSynchronizationGuide
          settings={settings}
          hasNotionIntegrationToken={hasNotionIntegrationToken}
          onChangeCatalogSettings={onChange}
          onClose={closeNotionSynchronizationGuide}
          onDeleteNotionIntegrationToken={async () => {
            await onDeleteNotionIntegrationToken();
            setHasNotionToken(false);
          }}
          onOpenNotionDevelopers={onOpenNotionDevelopers}
          onSaveNotionIntegrationToken={async (token) => {
            await onSaveNotionIntegrationToken(token);
            setHasNotionToken(true);
          }}
          onTestNotionCatalogConnection={onTestNotionCatalogConnection}
        />
      ) : null}
      {isAiProviderSetupGuideOpen ? (
        <AiProviderSetupGuide
          settings={settings}
          hasAiProviderApiKey={hasAiProviderApiKey}
          aiCredentialMessage={aiCredentialMessage}
          isTestingAiProviderConnection={isTestingAiProviderConnection}
          onChange={onChange}
          onClose={closeAiProviderSetupGuide}
          onDeleteAiProviderApiKey={onDeleteAiProviderApiKey}
          onOpenAiProviderApiKeys={onOpenAiProviderApiKeys}
          onSaveAiProviderApiKey={onSaveAiProviderApiKey}
          onTestAiProviderApiKey={onTestAiProviderApiKey}
          onTestAiProviderConnection={onTestAiProviderConnection}
        />
      ) : null}
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

        <div className="mt-4 rounded border border-[#dfe1e6] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <KeyRound size={16} strokeWidth={2.25} />
              </span>
              <span className="min-w-0 truncate">Jira connection</span>
              <span
                aria-label={isJiraConnectionComplete ? "Jira connection complete" : "Jira connection needs setup"}
                className={`inline-flex shrink-0 items-center justify-center ${
                  isJiraConnectionComplete ? "text-[#36b37e]" : "text-[#ffab00]"
                }`}
                title={isJiraConnectionComplete ? "Jira connection complete" : "Jira connection needs setup"}
              >
                {isJiraConnectionComplete ? (
                  <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#4caf50] text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
                    <span className="absolute inset-0 bg-[#ffab00] [clip-path:polygon(50%_5%,96%_90%,4%_90%)]" />
                    <span className="relative top-[1px] text-[12px] font-black leading-none text-white">!</span>
                  </span>
                )}
              </span>
            </div>
            <Button className="settings-button-primary shrink-0" variant="secondary" onClick={() => setIsJiraConnectionGuideOpen(true)}>
              Setup
            </Button>
          </div>
          <div className="mb-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold text-[#172b4d]">Connection state</div>
              <p className="text-xs leading-relaxed text-[#6b778c]">
                Site URL, account email, and project key are configured through the guided setup.
              </p>
            </div>
            <SettingsReadOnlyRows
              rows={[
                ["Site URL", settings.jiraSiteUrl || "Not set"],
                ["Account email", settings.jiraAccountEmail || "Not set"],
                ["Creation project", settings.jiraCreationProjectKey || "Not set"],
                ["API token", hasJiraApiToken ? "Saved" : "Missing"]
              ]}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            Jira uses API tokens for now. Tokens are never stored in SQLite or backups. The backend stores the token in the OS credential store.
          </p>
        </div>

        <div className="mt-4 rounded border border-[#dfe1e6] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <img alt="" aria-hidden="true" className="h-5 w-5 rounded-[3px] object-contain" src={notionMark} />
              </span>
              <span className="min-w-0 truncate">Notion synchronization</span>
              <span
                aria-label={isNotionSynchronizationConfigured ? "Notion synchronization configured" : "Notion synchronization needs setup"}
                className={`inline-flex shrink-0 items-center justify-center ${
                  isNotionSynchronizationConfigured ? "text-[#36b37e]" : "text-[#ffab00]"
                }`}
                title={isNotionSynchronizationConfigured ? "Notion synchronization configured" : "Notion synchronization needs setup"}
              >
                {isNotionSynchronizationConfigured ? (
                  <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#4caf50] text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
                    <span className="absolute inset-0 bg-[#ffab00] [clip-path:polygon(50%_5%,96%_90%,4%_90%)]" />
                    <span className="relative top-[1px] text-[12px] font-black leading-none text-white">!</span>
                  </span>
                )}
              </span>
            </div>
            <Button className="settings-button-primary shrink-0" variant="secondary" onClick={() => setIsNotionSynchronizationGuideOpen(true)}>
              Setup
            </Button>
          </div>
          <div className="mb-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold text-[#172b4d]">Synchronization state</div>
              <p className="text-xs leading-relaxed text-[#6b778c]">
                Official area catalog sync is configured through the guided setup.
              </p>
            </div>
            <SettingsReadOnlyRows
              rows={[
                ["Catalog mode", catalogSourceModeLabel(settings.catalogSourceMode)],
                ["Source", settings.catalogSourceMode === "manual" ? "Manual fallback" : settings.catalogSourceUrl || defaultNotionCatalogUrl],
                ["Integration token", settings.catalogSourceMode === "notion" ? (hasNotionToken ? "Saved" : "Missing") : "Not required"]
              ]}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            Notion tokens follow the same secret boundary as Jira credentials and are never included in backups.
          </p>
        </div>

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
                <div className="text-xs font-medium text-[#6b778c]">Provider setup</div>
                <div className="text-sm font-medium text-[#172b4d]">
                  {settings.aiProvider === "None"
                    ? "No AI provider selected"
                    : hasAiProviderApiKey
                      ? "Credential saved"
                      : "No credential saved"}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#6b778c]">
                  Default model: {isAiProviderSelected ? settings.aiModel || defaultAiProviderModels[selectedAiProvider] : "Not selected"}
                </p>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-medium ${isAiProviderSelected && hasAiProviderApiKey ? "bg-[#e3fcef] text-[#006644]" : "bg-[#f4f5f7] text-[#6b778c]"}`}>
                {settings.aiProvider === "None" ? "Off" : hasAiProviderApiKey ? "Saved" : "Missing"}
              </span>
            </div>
            {aiCredentialMessage ? (
              <FeedbackNote className="mt-3" variant={aiCredentialMessageVariant(aiCredentialMessage)}>{aiCredentialMessage}</FeedbackNote>
            ) : null}
            <Button className="settings-button-primary mt-3 w-full justify-center" variant="secondary" onClick={() => setIsAiProviderSetupGuideOpen(true)}>
              Setup
            </Button>
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
    </DrawerShell>
  );
}

function catalogSourceModeLabel(mode: AppSettings["catalogSourceMode"]): string {
  if (mode === "notion") return "Sync from Notion page";
  if (mode === "public-exportable") return "Legacy external source";
  return "Manual catalog";
}

function aiCredentialMessageVariant(message: string) {
  if (/saved|removed/i.test(message)) return "success";
  if (/select|empty/i.test(message)) return "warning";
  return "error";
}

function SettingsReadOnlyRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="rounded border border-[#dfe1e6] bg-white">
      {rows.map(([label, value]) => (
        <div className="border-b border-[#ebecf0] px-3 py-2.5 last:border-b-0" key={label}>
          <div className="mb-1 text-xs font-semibold text-[#6b778c]">{label}</div>
          <div className="min-w-0 break-words text-sm text-[#172b4d]">{value}</div>
        </div>
      ))}
    </div>
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
