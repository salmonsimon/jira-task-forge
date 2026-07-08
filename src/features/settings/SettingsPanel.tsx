import { Bot, Check, Download, KeyRound, Settings, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, DetailBlock, DrawerShell, FeedbackNote, PanelHeader, SegmentedControl } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import type { AppSettings, CredentialConnectionTestResult, JiraConnectionTestResult, JiraProjectOption, NotionCatalogConnectionTestResult, NotionOAuthStartResult, ProjectSyncApplyRequest, ProjectSyncReview, ThemeMode } from "../../lib/types";
import { AiProviderSetupGuide, defaultAiProviderModels } from "./AiProviderSetupGuide";
import { JiraConnectionGuide } from "./JiraConnectionGuide";
import notionMark from "../../assets/notion-mark.png";
import { defaultNotionCatalogUrl, NotionSynchronizationGuide } from "./NotionSynchronizationGuide";

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
  onListAiProviderModels,
  onTestJiraApiTokenQuiet,
  onTestJiraConnectionSettings,
  onDiscoverProjectSync,
  onApplyProjectSync,
  hasNotionIntegrationToken,
  onDeleteNotionIntegrationToken,
  onStartNotionOAuthConnection,
  onCompleteNotionOAuthConnection,
  onTestNotionCatalogConnection,
  onListJiraProjectsForConnection,
  onOpenJiraApiTokens,
  onOpenCatalogSourceRequirements,
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
  onListAiProviderModels: (aiProvider: AppSettings["aiProvider"], apiKey?: string) => Promise<string[]>;
  onTestJiraApiTokenQuiet: (token: string, siteUrl: string, accountEmail: string) => Promise<JiraConnectionTestResult>;
  onTestJiraConnectionSettings: (siteUrl: string, accountEmail: string) => Promise<JiraConnectionTestResult>;
  onDiscoverProjectSync?: () => Promise<ProjectSyncReview>;
  onApplyProjectSync?: (request: ProjectSyncApplyRequest) => Promise<void>;
  hasNotionIntegrationToken: () => Promise<boolean>;
  onDeleteNotionIntegrationToken: () => Promise<void>;
  onStartNotionOAuthConnection: () => Promise<NotionOAuthStartResult>;
  onCompleteNotionOAuthConnection: (authorizationCode: string, state: string, pageUrlOrId: string) => Promise<NotionCatalogConnectionTestResult>;
  onTestNotionCatalogConnection: (pageUrlOrId: string, token?: string) => Promise<NotionCatalogConnectionTestResult>;
  onListJiraProjectsForConnection: (siteUrl: string, accountEmail: string) => Promise<JiraProjectOption[]>;
  onOpenJiraApiTokens: () => void;
  onOpenCatalogSourceRequirements: () => void;
  onOpenAiProviderApiKeys: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  initialGuide?: "jira-connection" | "notion-synchronization" | "ai-provider" | null;
  onInitialGuideClose?: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [isJiraConnectionGuideOpen, setIsJiraConnectionGuideOpen] = useState(initialGuide === "jira-connection");
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
  const isAiProviderConfigured = Boolean(isAiProviderSelected && settings.aiModel.trim() && hasAiProviderApiKey);
  const overlay = useAppOverlay({
    layer: appOverlayLayers.sidePanel,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    dismissOnOutsidePointer: true,
    lockScroll: true,
    surfaceRef: panelRef
  });

  function closeJiraConnectionGuide() {
    setIsJiraConnectionGuideOpen(false);
    if (initialGuide === "jira-connection") {
      onInitialGuideClose?.();
    }
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
    if (initialGuide === "jira-connection") {
      setIsJiraConnectionGuideOpen(true);
    }
  }, [initialGuide]);

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
          onDiscoverProjectSync={onDiscoverProjectSync}
          onApplyProjectSync={onApplyProjectSync}
          onOpenJiraApiTokens={onOpenJiraApiTokens}
          onClose={closeJiraConnectionGuide}
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
          onOpenCatalogSourceRequirements={onOpenCatalogSourceRequirements}
          onStartNotionOAuthConnection={onStartNotionOAuthConnection}
          onCompleteNotionOAuthConnection={async (authorizationCode, state, pageUrlOrId) => {
            const result = await onCompleteNotionOAuthConnection(authorizationCode, state, pageUrlOrId);
            setHasNotionToken(true);
            return result;
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
          onListAiProviderModels={onListAiProviderModels}
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
                ["Project sync", settings.projectSyncEnabled === false ? "Off" : "On"],
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
                ["Notion connection", settings.catalogSourceMode === "notion" ? (hasNotionToken ? "Connected" : "Missing") : "Not required"]
              ]}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            Notion OAuth tokens follow the same secret boundary as Jira credentials and are never included in backups.
          </p>
        </div>

        <div className="mt-4 rounded border border-[#dfe1e6] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <Bot size={16} strokeWidth={2.25} />
              </span>
              <span className="min-w-0 truncate">AI provider</span>
              <span
                aria-label={isAiProviderConfigured ? "AI provider configured" : "AI provider needs setup"}
                className={`inline-flex shrink-0 items-center justify-center ${
                  isAiProviderConfigured ? "text-[#36b37e]" : "text-[#ffab00]"
                }`}
                title={isAiProviderConfigured ? "AI provider configured" : "AI provider needs setup"}
              >
                {isAiProviderConfigured ? (
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
            <Button className="settings-button-primary shrink-0" variant="secondary" onClick={() => setIsAiProviderSetupGuideOpen(true)}>
              Setup
            </Button>
          </div>
          <div className="mb-3 rounded border border-[#dfe1e6] bg-[#f7f8fa] p-3">
            <div className="mb-3">
              <div className="text-sm font-semibold text-[#172b4d]">Provider state</div>
              <p className="text-xs leading-relaxed text-[#6b778c]">
                Provider, model, and API key are configured through the guided setup.
              </p>
            </div>
            <SettingsReadOnlyRows
              rows={[
                ["Provider", isAiProviderSelected ? settings.aiProvider : "Not set"],
                ["Model", isAiProviderSelected ? settings.aiModel || defaultAiProviderModels[selectedAiProvider] : "Not set"],
                ["API key", isAiProviderSelected ? (hasAiProviderApiKey ? "Saved" : "Missing") : "Not required"]
              ]}
            />
          </div>
          {aiCredentialMessage ? (
            <FeedbackNote className="mt-3" variant={aiCredentialMessageVariant(aiCredentialMessage)}>{aiCredentialMessage}</FeedbackNote>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-[#6b778c]">
            AI keys follow the same secret boundary as Jira credentials and are never included in backups.
          </p>
        </div>

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
