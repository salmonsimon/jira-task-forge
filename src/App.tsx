import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { listen } from "@tauri-apps/api/event";
import { downloadDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { AppHeader } from "./components/shell";
import { CategoriesPanel } from "./features/categories";
import { JiraPreflightDialog, type JiraCreatePreflight } from "./features/jira-preflight";
import { JqlView } from "./features/jql";
import { SettingsPanel } from "./features/settings";
import { TaskFocusWindow } from "./features/task-detail";
import { TraysView, useTrayWorkspace } from "./features/trays";
import { mockAppDataAdapter } from "./lib/adapters";
import { appOverlayLayers, useAppOverlay } from "./lib/app-overlays";
import {
  addPersistedTaskAttachmentsFromPaths,
  createPersistedCategory,
  createPersistedJiraParentIssues,
  createPersistedJqlFavorite,
  createPersistedRecoveryTrayFromTasks,
  deletePersistedCategory,
  deletePersistedAiProviderApiKey,
  deletePersistedJqlFavorite,
  deletePersistedJiraApiToken,
  deletePersistedTaskAttachment,
  draftPersistedJqlWithAi,
  exportPersistedBackup,
  generatePersistedTaskDescription,
  getPersistedAppSettings,
  hasPersistedAiProviderApiKey,
  hasPersistedJiraApiToken,
  importPersistedBackup,
  createPersistedAssistedDescriptionProposal,
  listPersistedCategories,
  listPersistedAssistedDescriptionProposals,
  listPersistedDescriptionProposalLog,
  listPersistedJqlFavorites,
  listPersistedTaskSyncLog,
  listPersistedTrays,
  markPersistedTasksCsvExported,
  openPersistedAiProviderApiKeysPage,
  openPersistedAtlassianApiTokensPage,
  openPersistedJiraIssueUrl,
  runPersistedJqlQuery,
  saveCsvFile,
  savePersistedAiProviderApiKey,
  savePersistedJiraApiToken,
  testPersistedAiProviderApiKey,
  testPersistedAiProviderConnection,
  testPersistedJiraApiToken,
  testPersistedJiraConnection,
  transitionPersistedAssistedDescriptionProposal,
  updatePersistedAppSettings,
  updatePersistedAssistedDescriptionProposalSection,
  updatePersistedCategory,
  updatePersistedJqlFavorite,
  updatePersistedTaskAttachmentPurpose
} from "./lib/adapters/tauriPersistence";
import {
  addJqlRecentQuery,
  canExportTrayCsv,
  classifyTrayPreflightWarnings,
  countCsvExportableTasks,
  countTasksBySyncStatus,
  exportLocalTasksToCsv,
  formatBackupTimestamp,
  redactSensitiveText,
  formatUnknownError,
  formatJqlAiDraftMessage,
  formatJqlQueryError,
  formatJqlQueryMessage,
  getVisibleBackupCounts,
  isEligibleForCsvExport,
  isSubtask,
  orderProjectNames
} from "./lib/domain";
import {
  formatJiraCreationResultCounts,
  getJiraCreationNoticeGuidance,
  shouldShowBlockingJiraCreationNotice
} from "./lib/domain/jiraCreation";
import {
  createEmptyAssistedDescriptionSections,
  serializeAssistedDescriptionSections
} from "./lib/domain/assistedDescription";
import type {
  AppSettings,
  AttachmentPurpose,
  AssistedDescriptionDraft,
  AiProvider,
  BackupOperationNotice,
  Category,
  CredentialConnectionTestResult,
  JqlAiDraft,
  JqlFavorite,
  JqlRecentQuery,
  JqlResult,
  JqlRunState,
  JiraConnectionTestResult,
  JiraCreateIssuesResult,
  JiraCreateProgress,
  LocalTask,
  MainTab,
  Panel,
  SyncLogEntry,
  Tray
} from "./lib/types";
import { cn } from "./lib/utils";

const appData = mockAppDataAdapter;
const defaultAppSettings: AppSettings = {
  themeMode: "dark",
  jiraSiteUrl: "https://dts.atlassian.net",
  jiraAccountEmail: "",
  jiraAuthMethod: "api-token",
  jiraCreationProjectKey: "",
  aiProvider: "OpenAI",
  aiModel: "gpt-4.1",
  defaultContentLanguage: "Spanish"
};
const defaultJqlPrompt = "Show me high and highest open bugs for STT, sorted by priority";
const atlassianApiTokensUrl = "https://id.atlassian.com/manage-profile/security/api-tokens";
const aiProviderApiKeysUrls: Partial<Record<AiProvider, string>> = {
  OpenAI: "https://platform.openai.com/home",
  Claude: "https://platform.claude.com/dashboard",
  Gemini: "https://aistudio.google.com/api-keys"
};

type ConnectionNotice = {
  id: number;
  kind: "success" | "error";
  title: string;
  message: string;
  detail?: string | null;
};

type CsvExportNotice = {
  id: number;
  taskCount: number;
  trayName: string;
  fileName: string;
};

type JiraCreationNotice = {
  id: number;
  sourceTrayId: string;
  sourceTrayName: string;
  result: JiraCreateIssuesResult;
  recoveryError?: string | null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("trays");
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [categories, setCategories] = useState<Category[]>(() => [...appData.listProjects(), ...appData.listAreas()]);
  const [jqlFavorites, setJqlFavorites] = useState<JqlFavorite[]>(() => appData.listJqlFavorites());
  const [taskSyncLogs, setTaskSyncLogs] = useState<Record<string, SyncLogEntry[]>>({});
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | undefined>(appData.listJqlFavorites()[0]?.id);
  const [jqlRecentQueries, setJqlRecentQueries] = useState<JqlRecentQuery[]>([]);
  const [jqlMode, setJqlMode] = useState<"direct" | "ai">("ai");
  const [jqlQuery, setJqlQuery] = useState(appData.listJqlFavorites()[0]?.jql ?? "");
  const [jqlPrompt, setJqlPrompt] = useState(defaultJqlPrompt);
  const [jqlAiDraft, setJqlAiDraft] = useState<JqlAiDraft | null>(null);
  const [jqlAiMessage, setJqlAiMessage] = useState<string | null>(null);
  const [jqlResults, setJqlResults] = useState<JqlResult[]>([]);
  const [jqlRunState, setJqlRunState] = useState<JqlRunState>("idle");
  const [jqlQueryMessage, setJqlQueryMessage] = useState<string | null>(null);
  const [isRunningJqlQuery, setIsRunningJqlQuery] = useState(false);
  const [isDraftingJqlWithAi, setIsDraftingJqlWithAi] = useState(false);
  const [generatingDescriptionTaskId, setGeneratingDescriptionTaskId] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [usesTauriPersistence, setUsesTauriPersistence] = useState(false);
  const [csvExportMessage, setCsvExportMessage] = useState<string | null>(null);
  const [csvExportNotice, setCsvExportNotice] = useState<CsvExportNotice | null>(null);
  const [jiraCreationNotice, setJiraCreationNotice] = useState<JiraCreationNotice | null>(null);
  const [hasJiraApiToken, setHasJiraApiToken] = useState(false);
  const [hasAiProviderApiKey, setHasAiProviderApiKey] = useState(false);
  const [jiraCredentialMessage, setJiraCredentialMessage] = useState<string | null>(null);
  const [aiCredentialMessage, setAiCredentialMessage] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<ConnectionNotice | null>(null);
  const [backupNotice, setBackupNotice] = useState<BackupOperationNotice | null>(null);
  const [isTestingJiraConnection, setIsTestingJiraConnection] = useState(false);
  const [isTestingAiProviderConnection, setIsTestingAiProviderConnection] = useState(false);
  const [isRunningJiraPreflight, setIsRunningJiraPreflight] = useState(false);
  const [jiraCreatePreflight, setJiraCreatePreflight] = useState<JiraCreatePreflight | null>(null);
  const [isCreatingJiraIssues, setIsCreatingJiraIssues] = useState(false);
  const [isCreatingRecoveryTray, setIsCreatingRecoveryTray] = useState(false);
  const [jiraCreateResult, setJiraCreateResult] = useState<JiraCreateIssuesResult | null>(null);
  const [jiraCreateError, setJiraCreateError] = useState<string | null>(null);
  const [jiraCreateProgress, setJiraCreateProgress] = useState<JiraCreateProgress | null>(null);
  const trayWorkspace = useTrayWorkspace({
    initialTrays: appData.listTrays(),
    usesTauriPersistence
  });
  const {
    trays,
    visibleTrays,
    selectedTray,
    selectedTrayId,
    selectedTask,
    selectedTaskId,
    selectedTaskTray,
    showArchivedTrays,
    trayPendingDelete
  } = trayWorkspace;

  const selectedTaskWithSyncLog = useMemo(() => {
    if (!selectedTask) return null;
    return {
      ...selectedTask,
      syncLog: taskSyncLogs[selectedTask.id] ?? selectedTask.syncLog
    };
  }, [selectedTask, taskSyncLogs]);

  const projectCategories = useMemo(() => categories.filter((category) => category.categoryType === "project"), [categories]);
  const areaCategories = useMemo(() => categories.filter((category) => category.categoryType === "area"), [categories]);
  const projectOptions = useMemo(
    () => orderProjectNames(projectCategories.filter((project) => !project.hidden).map((project) => project.name)),
    [projectCategories]
  );
  const areaOptions = useMemo(() => areaCategories.filter((area) => !area.hidden).map((area) => area.name), [areaCategories]);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      listPersistedTrays(),
      getPersistedAppSettings(),
      hasPersistedJiraApiToken(),
      listPersistedCategories(),
      listPersistedJqlFavorites()
    ])
      .then(([persistedTrays, persistedSettings, hasPersistedToken, persistedCategories, persistedJqlFavorites]) => {
        if (!isCurrent) return;
        const nextCategories = persistedCategories.length ? persistedCategories : [...appData.listProjects(), ...appData.listAreas()];
        const nextJqlFavorites = persistedJqlFavorites.length ? persistedJqlFavorites : appData.listJqlFavorites();

        setUsesTauriPersistence(true);
        trayWorkspace.replaceTrays(persistedTrays);
        setAppSettings(persistedSettings);
        setHasJiraApiToken(hasPersistedToken);
        setCategories(nextCategories);
        setJqlFavorites(nextJqlFavorites);
        setSelectedFavoriteId((currentFavoriteId) =>
          currentFavoriteId && nextJqlFavorites.some((favorite) => favorite.id === currentFavoriteId)
            ? currentFavoriteId
            : nextJqlFavorites[0]?.id
        );
      })
      .catch(() => {
        if (!isCurrent) return;
        setUsesTauriPersistence(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!usesTauriPersistence || appSettings.aiProvider === "None") {
      setHasAiProviderApiKey(false);
      return;
    }

    let isCurrent = true;
    hasPersistedAiProviderApiKey(appSettings.aiProvider)
      .then((hasCredential) => {
        if (!isCurrent) return;
        setHasAiProviderApiKey(hasCredential);
      })
      .catch(() => {
        if (!isCurrent) return;
        setHasAiProviderApiKey(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [appSettings.aiProvider, usesTauriPersistence]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<JiraCreateProgress>("jira-create-progress", (event) => {
      setJiraCreateProgress(event.payload);
    })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten;
      })
      .catch(() => {
        // Event listening is only available in the native Tauri shell.
      });

    return () => {
      unlisten?.();
    };
  }, []);

  useAppOverlay({
    enabled: openPanel === "categories",
    layer: appOverlayLayers.sidePanel,
    lockScroll: true
  });

  useEffect(() => {
    if (!connectionNotice) return;

    const timeoutId = window.setTimeout(() => setConnectionNotice(null), 7000);
    return () => window.clearTimeout(timeoutId);
  }, [connectionNotice]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updatePreference = () => setSystemPrefersDark(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const resolvedTheme = appSettings.themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : appSettings.themeMode;

  async function refreshPersistedWorkspaceData() {
    const [persistedTrays, persistedSettings, persistedCategories, persistedJqlFavorites] = await Promise.all([
      listPersistedTrays(),
      getPersistedAppSettings(),
      listPersistedCategories(),
      listPersistedJqlFavorites()
    ]);
    const nextCategories = persistedCategories.length ? persistedCategories : [...appData.listProjects(), ...appData.listAreas()];
    const nextJqlFavorites = persistedJqlFavorites.length ? persistedJqlFavorites : appData.listJqlFavorites();

    trayWorkspace.replaceTrays(persistedTrays);
    setAppSettings(persistedSettings);
    setCategories(nextCategories);
    setJqlFavorites(nextJqlFavorites);
    setSelectedFavoriteId((currentFavoriteId) =>
      currentFavoriteId && nextJqlFavorites.some((favorite) => favorite.id === currentFavoriteId)
        ? currentFavoriteId
        : nextJqlFavorites[0]?.id
    );
  }

  useEffect(() => {
    if (openPanel === "detail" && !selectedTask) {
      setOpenPanel(null);
    }
  }, [openPanel, selectedTask]);

  useEffect(() => {
    if (openPanel !== "detail" || !selectedTaskId || !usesTauriPersistence) return;

    let isCurrent = true;
    listPersistedTaskSyncLog(selectedTaskId)
      .then((syncLog) => {
        if (!isCurrent) return;
        setTaskSyncLogs((currentLogs) => ({ ...currentLogs, [selectedTaskId]: syncLog }));
      })
      .catch(() => {
        if (!isCurrent) return;
        setTaskSyncLogs((currentLogs) => ({ ...currentLogs, [selectedTaskId]: [] }));
      });

    return () => {
      isCurrent = false;
    };
  }, [openPanel, selectedTaskId, usesTauriPersistence]);

  useEffect(() => {
    setCsvExportMessage(null);
    setCsvExportNotice(null);
  }, [selectedTrayId]);

  function openTask(task: LocalTask) {
    trayWorkspace.openTask(task);
    setOpenPanel("detail");
  }

  function openTray(tray: Tray) {
    trayWorkspace.openTray(tray);
    setActiveTab("trays");
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
  }

  async function generateTaskDescription(taskId: string, additionalContext: string): Promise<AssistedDescriptionDraft> {
    const tray = trays.find((candidate) => candidate.tasks.some((task) => task.id === taskId));
    const task = tray?.tasks.find((candidate) => candidate.id === taskId);
    if (!tray || !task || tray.state === "Archived" || task.syncStatus === "Created") {
      throw new Error("This task cannot be edited.");
    }
    if (usesTauriPersistence && appSettings.aiProvider === "None") {
      throw new Error("Select an AI provider in Settings before generating a description.");
    }
    if (usesTauriPersistence && !hasAiProviderApiKey) {
      throw new Error(`Save a ${appSettings.aiProvider} API key in Settings before generating a description.`);
    }

    setGeneratingDescriptionTaskId(taskId);
    try {
      if (!usesTauriPersistence) return createPreviewAssistedDescription(task, additionalContext);

      try {
        return await generatePersistedTaskDescription(taskId, additionalContext);
      } catch (error) {
        if (isTaskDescriptionCommandUnavailable(error)) {
          return createPreviewAssistedDescription(task, additionalContext);
        }
        throw error;
      }
    } finally {
      setGeneratingDescriptionTaskId(null);
    }
  }

  async function refreshPersistedTask(taskId: string) {
    if (!usesTauriPersistence) return;
    const persistedTrays = await listPersistedTrays();
    trayWorkspace.replaceTrays(persistedTrays, {
      fallbackSelectedTrayId: selectedTrayId,
      fallbackSelectedTaskId: taskId
    });
  }

  async function chooseTaskAttachmentFiles(taskId: string) {
    if (!usesTauriPersistence) {
      throw new Error("Attachment storage requires the desktop app.");
    }
    const selectedPaths = await open({
      directory: false,
      multiple: true
    });
    const paths = Array.isArray(selectedPaths) ? selectedPaths : selectedPaths ? [selectedPaths] : [];
    if (!paths.length) return;

    const updatedTask = await addPersistedTaskAttachmentsFromPaths(taskId, paths, "AI + Jira attachment");
    if (updatedTask) trayWorkspace.replaceTask(updatedTask);
  }

  async function updateTaskAttachmentPurpose(taskId: string, attachmentId: string, purpose: AttachmentPurpose) {
    if (!usesTauriPersistence) {
      throw new Error("Attachment storage requires the desktop app.");
    }
    const updatedTask = await updatePersistedTaskAttachmentPurpose(taskId, attachmentId, purpose);
    if (updatedTask) trayWorkspace.replaceTask(updatedTask);
  }

  async function deleteTaskAttachment(taskId: string, attachmentId: string) {
    if (!usesTauriPersistence) {
      throw new Error("Attachment storage requires the desktop app.");
    }
    const updatedTask = await deletePersistedTaskAttachment(taskId, attachmentId);
    if (updatedTask) trayWorkspace.replaceTask(updatedTask);
  }

  async function updateAppSettings(settingsPatch: Partial<AppSettings>): Promise<boolean> {
    const previousSettings = appSettings;
    const nextSettings = {
      ...appSettings,
      ...settingsPatch
    };

    setAppSettings(nextSettings);
    if (!usesTauriPersistence) return true;

    try {
      const persistedSettings = await updatePersistedAppSettings(nextSettings);
      setAppSettings(persistedSettings);
      return true;
    } catch {
      setAppSettings(previousSettings);
      return false;
    }
  }

  async function createCategory(categoryType: "project" | "area", name: string) {
    const nextName = name.trim();
    if (!nextName) return;

    const category = usesTauriPersistence
      ? await createPersistedCategory(categoryType, nextName)
      : {
          id: `category-local-${Date.now().toString(36)}`,
          categoryType,
          name: nextName,
          source: "local" as const
        };
    setCategories((currentCategories) => [...currentCategories, category]);
  }

  async function updateCategory(categoryId: string, patch: Partial<Pick<Category, "hidden" | "name">>) {
    const nextPatch: Partial<Pick<Category, "hidden" | "name">> = {};
    if (patch.name !== undefined) {
      const nextName = patch.name.trim();
      if (!nextName) return;
      nextPatch.name = nextName;
    }
    if (patch.hidden !== undefined) {
      nextPatch.hidden = patch.hidden;
    }

    const updatedCategory = usesTauriPersistence
      ? await updatePersistedCategory(categoryId, nextPatch)
      : (categories.find((category) => category.id === categoryId)
          ? { ...categories.find((category) => category.id === categoryId)!, ...nextPatch }
          : null);
    if (!updatedCategory) return;

    setCategories((currentCategories) =>
      currentCategories.map((category) => (category.id === categoryId ? updatedCategory : category))
    );
  }

  async function deleteCategory(categoryId: string) {
    if (usesTauriPersistence) {
      const deleted = await deletePersistedCategory(categoryId);
      if (!deleted) return;
    }

    setCategories((currentCategories) => currentCategories.filter((category) => category.id !== categoryId));
  }

  async function openJiraIssue(url: string) {
    if (usesTauriPersistence) {
      try {
        await openPersistedJiraIssueUrl(url);
      } catch {
        console.warn("Could not open Jira issue URL.");
      }
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function openJiraApiTokensPage() {
    if (usesTauriPersistence) {
      try {
        await openPersistedAtlassianApiTokensPage();
        return;
      } catch {
        setJiraCredentialMessage(
          `Could not open Atlassian automatically. Open ${atlassianApiTokensUrl} in your browser.`
        );
      }
    }

    window.open(atlassianApiTokensUrl, "_blank", "noopener,noreferrer");
  }

  async function openAiProviderApiKeysPage() {
    const url = aiProviderApiKeysUrls[appSettings.aiProvider];
    if (!url) {
      setAiCredentialMessage("Select an AI provider before opening its API key page.");
      return;
    }

    if (usesTauriPersistence) {
      try {
        await openPersistedAiProviderApiKeysPage(appSettings.aiProvider);
        return;
      } catch {
        setAiCredentialMessage(
          `Could not open ${appSettings.aiProvider} automatically. Open ${url} in your browser.`
        );
      }
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function showConnectionNotice(notice: Omit<ConnectionNotice, "id">) {
    setConnectionNotice({
      ...notice,
      message: redactSensitiveText(notice.message),
      detail: notice.detail ? redactSensitiveText(notice.detail) : notice.detail,
      id: Date.now()
    });
  }

  function showJiraConnectionNotice(result: JiraConnectionTestResult) {
    showConnectionNotice({
      kind: result.ok ? "success" : "error",
      title: result.ok ? "Jira connection succeeded" : "Jira connection failed",
      message: result.message,
      detail:
        result.ok && result.accountDisplayName
          ? `Connected as ${result.accountDisplayName}${result.accountEmail ? ` (${result.accountEmail})` : ""}`
          : null
    });
  }

  function showAiConnectionNotice(result: CredentialConnectionTestResult) {
    showConnectionNotice({
      kind: result.ok ? "success" : "error",
      title: result.ok ? "AI Provider connection succeeded" : "AI Provider connection failed",
      message: result.message,
      detail: result.detail
    });
  }

  async function saveJiraApiToken(token: string) {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setJiraCredentialMessage("Token cannot be empty.");
      return false;
    }

    try {
      await savePersistedJiraApiToken(trimmedToken);
      setHasJiraApiToken(true);
      setJiraCredentialMessage("Jira API token saved in the OS credential store.");
      return true;
    } catch {
      setJiraCredentialMessage("Could not save Jira API token in the OS credential store.");
      return false;
    }
  }

  async function deleteJiraApiToken() {
    try {
      await deletePersistedJiraApiToken();
      setHasJiraApiToken(false);
      setJiraCredentialMessage("Jira API token removed from the OS credential store.");
    } catch {
      setJiraCredentialMessage("Could not remove Jira API token.");
    }
  }

  async function saveAiProviderApiKey(apiKey: string) {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setAiCredentialMessage("API key cannot be empty.");
      return false;
    }
    if (appSettings.aiProvider === "None") {
      setAiCredentialMessage("Select an AI provider before saving an API key.");
      return false;
    }

    try {
      await savePersistedAiProviderApiKey(appSettings.aiProvider, trimmedApiKey);
      setHasAiProviderApiKey(true);
      setAiCredentialMessage(`${appSettings.aiProvider} API key saved in the OS credential store.`);
      return true;
    } catch {
      setAiCredentialMessage(`Could not save ${appSettings.aiProvider} API key in the OS credential store.`);
      return false;
    }
  }

  async function deleteAiProviderApiKey() {
    if (appSettings.aiProvider === "None") {
      setAiCredentialMessage("Select an AI provider before removing an API key.");
      return;
    }

    try {
      await deletePersistedAiProviderApiKey(appSettings.aiProvider);
      setHasAiProviderApiKey(false);
      setAiCredentialMessage(`${appSettings.aiProvider} API key removed from the OS credential store.`);
    } catch {
      setAiCredentialMessage(`Could not remove ${appSettings.aiProvider} API key.`);
    }
  }

  async function testAiProviderConnection(): Promise<CredentialConnectionTestResult> {
    flushSync(() => {
      setIsTestingAiProviderConnection(true);
      setAiCredentialMessage(null);
    });
    const loadingStartedAt = performance.now();
    await waitForNextPaint();

    try {
      const message = await testPersistedAiProviderConnection();
      const result: CredentialConnectionTestResult = { ok: true, message };
      showAiConnectionNotice(result);
      return result;
    } catch (error) {
      const result: CredentialConnectionTestResult = {
        ok: false,
        message: formatUnknownError(error, "Could not test AI provider connection.")
      };
      showAiConnectionNotice(result);
      return result;
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 700);
      setIsTestingAiProviderConnection(false);
    }
  }

  async function testAiProviderApiKey(apiKey: string): Promise<CredentialConnectionTestResult> {
    flushSync(() => {
      setIsTestingAiProviderConnection(true);
      setAiCredentialMessage(null);
    });
    const loadingStartedAt = performance.now();
    await waitForNextPaint();

    try {
      const message = await testPersistedAiProviderApiKey(appSettings.aiProvider, apiKey);
      const result: CredentialConnectionTestResult = { ok: true, message };
      showAiConnectionNotice(result);
      return result;
    } catch (error) {
      const result: CredentialConnectionTestResult = {
        ok: false,
        message: formatUnknownError(error, "Could not test AI provider connection.")
      };
      showAiConnectionNotice(result);
      return result;
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 700);
      setIsTestingAiProviderConnection(false);
    }
  }

  async function testJiraConnection(): Promise<JiraConnectionTestResult> {
    flushSync(() => {
      setIsTestingJiraConnection(true);
    });
    const loadingStartedAt = performance.now();
    await waitForNextPaint();
    await delay(500);

    try {
      const result = await testPersistedJiraConnection();
      showJiraConnectionNotice(result);
      return result;
    } catch (error) {
      const result = {
        ok: false,
        message: formatUnknownError(error, "Could not test Jira connection.")
      };
      showJiraConnectionNotice(result);
      return result;
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 800);
      setIsTestingJiraConnection(false);
    }
  }

  async function testJiraApiToken(token: string): Promise<JiraConnectionTestResult> {
    flushSync(() => {
      setIsTestingJiraConnection(true);
      setJiraCredentialMessage(null);
    });
    const loadingStartedAt = performance.now();
    await waitForNextPaint();
    await delay(500);

    try {
      const result = await testPersistedJiraApiToken(token);
      showJiraConnectionNotice(result);
      return result;
    } catch (error) {
      const result = {
        ok: false,
        message: formatUnknownError(error, "Could not test Jira connection.")
      };
      showJiraConnectionNotice(result);
      return result;
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 800);
      setIsTestingJiraConnection(false);
    }
  }

  function selectJqlFavorite(favoriteId: string) {
    const favorite = jqlFavorites.find((candidate) => candidate.id === favoriteId);
    setSelectedFavoriteId(favoriteId);
    if (favorite) {
      setJqlQuery(favorite.jql);
      setJqlMode("direct");
      setJqlResults([]);
      setJqlRunState("idle");
      setJqlQueryMessage(null);
    }
  }

  function selectJqlRecentQuery(recentQuery: JqlRecentQuery) {
    setSelectedFavoriteId(undefined);
    setJqlMode("direct");
    setJqlQuery(recentQuery.jql);
    setJqlResults([]);
    setJqlRunState("idle");
    setJqlQueryMessage(null);
  }

  function recordJqlRecentQuery(
    query: string,
    result: Pick<JqlRecentQuery, "status" | "resultCount">
  ) {
    setJqlRecentQueries((currentQueries) => addJqlRecentQuery(currentQueries, query, result));
  }

  async function saveJqlFavorite() {
    const query = jqlQuery.trim();
    if (!query) {
      setJqlQueryMessage("JQL query is required before saving a favorite.");
      return;
    }

    const existing = jqlFavorites.find((favorite) => favorite.jql.trim() === query);
    if (existing) {
      setSelectedFavoriteId(existing.id);
      setJqlQueryMessage("Favorite already saved.");
      return;
    }

    const favoriteName = `Favorite ${jqlFavorites.length + 1}`;
    const favorite = usesTauriPersistence
      ? await createPersistedJqlFavorite(favoriteName, query)
      : { id: `fav-local-${Date.now().toString(36)}`, name: favoriteName, jql: query };
    setJqlFavorites((currentFavorites) => [favorite, ...currentFavorites]);
    setSelectedFavoriteId(favorite.id);
    setJqlMode("direct");
    setJqlQuery(query);
    setJqlQueryMessage("Favorite saved.");
  }

  async function renameJqlFavorite(favoriteId: string, name: string) {
    const nextName = name.trim();
    if (!nextName) return;

    const updatedFavorite = usesTauriPersistence
      ? await updatePersistedJqlFavorite(favoriteId, { name: nextName })
      : (jqlFavorites.find((favorite) => favorite.id === favoriteId)
          ? { ...jqlFavorites.find((favorite) => favorite.id === favoriteId)!, name: nextName }
          : null);
    if (!updatedFavorite) return;

    setJqlFavorites((currentFavorites) =>
      currentFavorites.map((favorite) => (favorite.id === favoriteId ? updatedFavorite : favorite))
    );
  }

  async function deleteJqlFavorite(favoriteId: string) {
    const deleted = usesTauriPersistence ? await deletePersistedJqlFavorite(favoriteId) : true;
    if (!deleted) return;

    const nextFavorites = jqlFavorites.filter((favorite) => favorite.id !== favoriteId);
    const nextFavorite = nextFavorites[0];
    setJqlFavorites(nextFavorites);
    if (selectedFavoriteId === favoriteId) {
      setSelectedFavoriteId(nextFavorite?.id);
      if (nextFavorite) setJqlQuery(nextFavorite.jql);
    }
    setJqlQueryMessage("Favorite removed.");
  }

  async function runJqlQuery() {
    const query = jqlQuery.trim();
    if (!query) {
      setJqlResults([]);
      setJqlRunState("error");
      setJqlQueryMessage("JQL query is required.");
      return;
    }

    setIsRunningJqlQuery(true);
    setJqlRunState("running");
    const loadingStartedAt = performance.now();
    await waitForNextPaint();
    setJqlResults([]);
    setJqlQueryMessage("Running JQL query...");
    await waitForNextPaint();

    try {
      const queryResult = usesTauriPersistence
        ? await runPersistedJqlQuery(query)
        : {
            results: appData.listJqlResults(),
            isLast: true,
            nextPageToken: null,
            warningMessages: []
      };
      setJqlResults(queryResult.results);
      setJqlRunState("success");
      recordJqlRecentQuery(query, { status: "success", resultCount: queryResult.results.length });
      setJqlQueryMessage(formatJqlQueryMessage(queryResult.results.length, queryResult.isLast, queryResult.warningMessages));
    } catch (error) {
      setJqlResults([]);
      setJqlRunState("error");
      recordJqlRecentQuery(query, { status: "error" });
      setJqlQueryMessage(formatJqlQueryError(error));
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 1000);
      setIsRunningJqlQuery(false);
    }
  }

  async function draftJqlWithAi() {
    const prompt = jqlPrompt.trim();
    if (!prompt) {
      setJqlAiMessage("Describe the Jira issues you want to find.");
      return;
    }
    if (usesTauriPersistence && appSettings.aiProvider === "None") {
      setJqlAiMessage("Select an AI provider in Settings before using Ask AI.");
      return;
    }
    if (!hasAiProviderApiKey && usesTauriPersistence) {
      setJqlAiMessage(`Save a ${appSettings.aiProvider} API key in Settings before using Ask AI.`);
      return;
    }

    setIsDraftingJqlWithAi(true);
    setJqlAiDraft(null);
    setJqlAiMessage("Drafting JQL...");
    const loadingStartedAt = performance.now();
    await waitForNextPaint();

    try {
      const draft = usesTauriPersistence
        ? await draftPersistedJqlWithAi(prompt)
        : {
            jql: 'project = DTS AND labels = "Bug" AND priority in (High, Highest) AND statusCategory != Done ORDER BY priority DESC',
            explanation: "Generated a local preview query because the native AI backend is unavailable.",
            warnings: ["Preview mode only."]
          };
      setJqlAiDraft(draft);
      setSelectedFavoriteId(undefined);
      setJqlMode("direct");
      setJqlQuery(draft.jql);
      setJqlResults([]);
      setJqlRunState("idle");
      setJqlQueryMessage("AI-generated JQL loaded into the editor. Review it, then run the query.");
      setJqlAiMessage(formatJqlAiDraftMessage(draft));
    } catch (error) {
      setJqlAiMessage(formatUnknownError(error, "Could not draft JQL with AI."));
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 700);
      setIsDraftingJqlWithAi(false);
    }
  }

  async function exportBackup() {
    if (!usesTauriPersistence) {
      setBackupNotice({
        kind: "error",
        title: "Backup export unavailable",
        summary: "Backup export is available in the native app."
      });
      return;
    }

    setBackupNotice(null);
    const path = await save({
      defaultPath: `jira-task-forge-backup-${formatBackupTimestamp(new Date())}.json`,
      filters: [{ name: "Jira Task Forge backup", extensions: ["json"] }]
    });
    if (!path) return;

    try {
      const result = await exportPersistedBackup(path);
      const totalRecords = Object.values(result.recordCounts).reduce((total, count) => total + count, 0);
      setBackupNotice({
        kind: "success",
        title: "Backup exported",
        summary: `${totalRecords} records exported. Secrets included: ${result.secretsIncluded ? "yes" : "no"}.`,
        primaryCounts: result.recordCounts
      });
    } catch (error) {
      setBackupNotice({
        kind: "error",
        title: "Backup export failed",
        summary: error instanceof Error ? error.message : "Could not export backup."
      });
    }
  }

  async function importBackup() {
    if (!usesTauriPersistence) {
      setBackupNotice({
        kind: "error",
        title: "Backup import unavailable",
        summary: "Backup import is available in the native app."
      });
      return;
    }

    setBackupNotice(null);
    const selectedPath = await open({
      multiple: false,
      filters: [{ name: "Jira Task Forge backup", extensions: ["json"] }]
    });
    if (!selectedPath || Array.isArray(selectedPath)) return;

    try {
      const result = await importPersistedBackup(selectedPath);
      await refreshPersistedWorkspaceData();
      const importedRecords = Object.values(result.importedCounts).reduce((total, count) => total + count, 0);
      const skippedRecords = Object.values(result.skippedCounts).reduce((total, count) => total + count, 0);
      setBackupNotice({
        kind: "success",
        title: "Backup imported",
        summary: `${importedRecords} new records imported. ${skippedRecords} existing records skipped. Settings were updated from the backup.`,
        primaryCounts: result.importedCounts,
        secondaryCounts: result.skippedCounts,
        warnings: result.warnings
      });
    } catch (error) {
      setBackupNotice({
        kind: "error",
        title: "Backup import failed",
        summary: error instanceof Error ? error.message : "Could not import backup."
      });
    }
  }

  async function exportTrayCsv(tray: Tray) {
    setCsvExportMessage(null);
    setCsvExportNotice(null);

    const csvExportOptions = { includeExported: true };
    if (!canExportTrayCsv(tray, csvExportOptions)) {
      setCsvExportMessage(
        tray.state === "Completed"
          ? "Completed Jira trays cannot be exported to CSV."
          : "No pending, failed, or exported tasks to export."
      );
      return;
    }
    const exportableTasks = tray.tasks.filter((task) => isEligibleForCsvExport(task, csvExportOptions));
    const exportableCount = countCsvExportableTasks(tray.tasks, csvExportOptions);

    const csv = exportLocalTasksToCsv(tray.tasks, { includeExported: true });
    const defaultFilename = `${toFileSlug(tray.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
    const defaultPath = await getDefaultCsvExportPath(defaultFilename);
    const saveOptions: {
      defaultPath?: string;
      filters: Array<{ name: string; extensions: string[] }>;
    } = {
      filters: [
        {
          name: "CSV",
          extensions: ["csv"]
        }
      ]
    };
    if (defaultPath) saveOptions.defaultPath = defaultPath;

    const path = await save(saveOptions);

    if (!path) {
      setCsvExportMessage("CSV export cancelled.");
      return;
    }

    try {
      await saveCsvFile(path, `\uFEFF${csv}`);
    } catch (error) {
      setCsvExportMessage(formatUnknownError(error, "CSV could not be saved."));
      return;
    }

    try {
      const exportedTasks = usesTauriPersistence
        ? await markPersistedTasksCsvExported(exportableTasks.map((task) => task.id))
        : exportableTasks.map((task) =>
            task.syncStatus === "Pending" || task.syncStatus === "Failed"
              ? {
                  ...task,
                  syncStatus: "Exported" as const
                }
              : task
          );
      const exportedTasksById = new Map(exportedTasks.map((task) => [task.id, task]));

      trayWorkspace.updateTrayTaskList(tray.id, (currentTray) =>
        currentTray.tasks.map((task) => exportedTasksById.get(task.id) ?? task)
      );
    } catch {
      setCsvExportMessage("CSV downloaded, but task status could not be updated.");
      return;
    }

    setCsvExportNotice({
      id: Date.now(),
      taskCount: exportableCount,
      trayName: tray.name,
      fileName: getFileNameFromPath(path)
    });
  }

  async function createInJiraPreflight(tray: Tray) {
    setIsRunningJiraPreflight(true);
    setJiraCreateResult(null);
    setJiraCreateError(null);
    setJiraCreateProgress(null);
    setJiraCreationNotice(null);
    const loadingStartedAt = performance.now();
    await waitForNextPaint();

    const warnings = classifyTrayPreflightWarnings(tray.tasks);
    const createableTaskCount = tray.tasks.filter((task) => task.syncStatus !== "Created").length;
    const creationProjectKey = appSettings.jiraCreationProjectKey.trim().toUpperCase();
    const creationTarget = `Jira project ${creationProjectKey || "not set"}`;

    if (!creationProjectKey) {
      warnings.push({
        code: "missing-creation-project",
        severity: "blocking",
        message: "A Jira project key is required before creating issues."
      });
    }

    const hasRequiredSettings = Boolean(appSettings.jiraSiteUrl.trim() && appSettings.jiraAccountEmail.trim() && hasJiraApiToken);
    if (!hasRequiredSettings) {
      warnings.push({
        code: "missing-credential",
        severity: "blocking",
        message: "Jira site URL, account email, and saved API token are required before creating issues."
      });
    }

    const shouldCheckCredential = hasRequiredSettings && usesTauriPersistence;

    setJiraCreatePreflight({
      tray,
      credentialResult: null,
      credentialStatus: shouldCheckCredential ? "checking" : "idle",
      warnings,
      createableTaskCount,
      creationTarget
    });
    await waitForMinimumElapsed(loadingStartedAt, 500);
    setIsRunningJiraPreflight(false);

    if (!shouldCheckCredential) return;

    await delay(350);

    try {
      const credentialResult = await testPersistedJiraConnection();
      setJiraCreatePreflight((currentPreflight) => {
        if (!currentPreflight || currentPreflight.tray.id !== tray.id) return currentPreflight;

        return {
          ...currentPreflight,
          credentialResult,
          credentialStatus: "checked",
          warnings: credentialResult.ok
            ? currentPreflight.warnings
            : [
                ...currentPreflight.warnings,
                {
                  code: "invalid-credential",
                  severity: "blocking",
                  message: credentialResult.message
                }
              ]
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not test Jira credentials.";
      const credentialResult = { ok: false, message };
      setJiraCreatePreflight((currentPreflight) => {
        if (!currentPreflight || currentPreflight.tray.id !== tray.id) return currentPreflight;

        return {
          ...currentPreflight,
          credentialResult,
          credentialStatus: "checked",
          warnings: [
            ...currentPreflight.warnings,
            {
              code: "invalid-credential",
              severity: "blocking",
              message
            }
          ]
        };
      });
    }
  }

  async function createJiraParentIssues(options: {
    allowMissingDescriptions: boolean;
    includeExportedTasks: boolean;
    includeMissingDescriptionTasks: boolean;
  }) {
    if (!jiraCreatePreflight || !usesTauriPersistence) return;

    const selectedCreateableTaskCount = countJiraApiCreateableTasks(
      jiraCreatePreflight.tray.tasks,
      options.includeExportedTasks,
      options.includeMissingDescriptionTasks
    );
    flushSync(() => {
      setIsCreatingJiraIssues(true);
      setJiraCreateResult(null);
      setJiraCreateError(null);
      setJiraCreateProgress({
        syncAttemptId: null,
        step: "starting",
        label: "Starting Jira creation",
        detail: `${selectedCreateableTaskCount} createable ${
          selectedCreateableTaskCount === 1 ? "Jira issue" : "Jira issues"
        }`,
        completedSteps: 0,
        totalSteps: 1,
        status: "running"
      });
    });
    let shouldClosePreflight = false;
    let nextCreateResult: JiraCreateIssuesResult | null = null;
    let nextCreateError: string | null = null;
    let nextCreationNotice: JiraCreationNotice | null = null;
    await waitForNextPaint();
    await delay(1000);

    try {
      const result = await createPersistedJiraParentIssues(
        jiraCreatePreflight.tray.id,
        options.allowMissingDescriptions,
        options.includeExportedTasks,
        options.includeMissingDescriptionTasks
      );
      const persistedTrays = await listPersistedTrays();
      trayWorkspace.replaceTrays(persistedTrays, {
        fallbackSelectedTrayId: jiraCreatePreflight.tray.id
      });
      if (result.status === "succeeded" && result.failedIssueCount === 0) {
        shouldClosePreflight = true;
      } else if (shouldShowBlockingJiraCreationNotice(result)) {
        shouldClosePreflight = true;
        nextCreationNotice = {
          id: Date.now(),
          sourceTrayId: jiraCreatePreflight.tray.id,
          sourceTrayName: jiraCreatePreflight.tray.name,
          result
        };
      } else {
        nextCreateResult = result;
      }
    } catch (error) {
      nextCreateError = error instanceof Error ? error.message : String(error || "Could not create Jira issues.");
    } finally {
      setIsCreatingJiraIssues(false);
      if (shouldClosePreflight) {
        setJiraCreatePreflight(null);
        setJiraCreateResult(null);
        setJiraCreateError(null);
        setJiraCreateProgress(null);
      } else {
        if (nextCreateResult) setJiraCreateResult(nextCreateResult);
        if (nextCreateError) setJiraCreateError(nextCreateError);
      }
      if (nextCreationNotice) setJiraCreationNotice(nextCreationNotice);
    }
  }

  async function createRecoveryTrayFromJiraNotice() {
    if (!jiraCreationNotice || jiraCreationNotice.result.failedTasks.length === 0) return;

    setIsCreatingRecoveryTray(true);
    setJiraCreationNotice((notice) => notice ? { ...notice, recoveryError: null } : notice);

    try {
      const recoveryTray = await createPersistedRecoveryTrayFromTasks(
        jiraCreationNotice.sourceTrayId,
        jiraCreationNotice.result.failedTasks.map((task) => task.taskId)
      );
      const persistedTrays = await listPersistedTrays();
      trayWorkspace.replaceTraysAndSelect(persistedTrays, {
        selectedTrayId: recoveryTray.id,
        selectedTaskId: persistedTrays.find((tray) => tray.id === recoveryTray.id)?.tasks[0]?.id ?? null
      });
      setJiraCreationNotice(null);
    } catch (error) {
      const recoveryError = error instanceof Error ? error.message : String(error || "Could not create recovery tray.");
      setJiraCreationNotice((notice) => notice ? { ...notice, recoveryError } : notice);
    } finally {
      setIsCreatingRecoveryTray(false);
    }
  }

  async function createRecoveryTrayFromJiraResult() {
    if (!jiraCreatePreflight || !jiraCreateResult || jiraCreateResult.failedTasks.length === 0) return;

    setIsCreatingRecoveryTray(true);
    setJiraCreateError(null);

    try {
      const recoveryTray = await createPersistedRecoveryTrayFromTasks(
        jiraCreatePreflight.tray.id,
        jiraCreateResult.failedTasks.map((task) => task.taskId)
      );
      const persistedTrays = await listPersistedTrays();
      trayWorkspace.replaceTraysAndSelect(persistedTrays, {
        selectedTrayId: recoveryTray.id,
        selectedTaskId: persistedTrays.find((tray) => tray.id === recoveryTray.id)?.tasks[0]?.id ?? null
      });
      setJiraCreatePreflight(null);
    } catch (error) {
      setJiraCreateError(error instanceof Error ? error.message : String(error || "Could not create recovery tray."));
    } finally {
      setIsCreatingRecoveryTray(false);
    }
  }

  useEffect(() => {
    function handleSecondaryMouseNavigation(event: MouseEvent) {
      if (event.button === 3) {
        if (openPanel === "detail") {
          setOpenPanel(null);
          return;
        }
        if (selectedTrayId) {
          trayWorkspace.closeSelectedTray();
        }
      }

      if (event.button === 4 && !selectedTrayId) {
        const tray = trayWorkspace.restoreLastSelectedTray();
        if (tray) {
          setActiveTab("trays");
          requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
        }
      }
    }

    window.addEventListener("mouseup", handleSecondaryMouseNavigation);
    return () => window.removeEventListener("mouseup", handleSecondaryMouseNavigation);
  }, [openPanel, selectedTrayId, trayWorkspace]);

  return (
    <div className={cn("min-h-screen bg-[#f7f8fa] text-[#172b4d]", resolvedTheme === "dark" && "theme-dark")}>
      <div className="flex min-h-screen">
        <main className="flex min-w-0 flex-1 flex-col">
          <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} openPanel={setOpenPanel} />
          {activeTab === "trays" ? (
            <TraysView
              trays={visibleTrays}
              selectedTray={selectedTray}
              onOpenTray={openTray}
              onCreateTray={trayWorkspace.createTray}
              onRenameTray={trayWorkspace.renameTray}
              onArchiveTray={trayWorkspace.archiveTray}
              onRestoreTray={trayWorkspace.restoreTray}
              onDeleteTray={trayWorkspace.requestDeleteTray}
              onExportCsv={exportTrayCsv}
              onCreateInJira={createInJiraPreflight}
              csvExportMessage={csvExportMessage}
              isRunningJiraPreflight={isRunningJiraPreflight}
              showArchived={showArchivedTrays}
              onToggleArchived={trayWorkspace.toggleArchivedTrays}
              onBackToSelector={trayWorkspace.backToTraySelector}
              onOpenTask={openTask}
              onAddTask={trayWorkspace.addTaskToSelectedTray}
              onUpdateTask={trayWorkspace.updateTaskDetails}
              onDuplicateTask={trayWorkspace.duplicateTask}
              onDeleteTask={trayWorkspace.deleteTask}
              onOpenJiraIssue={openJiraIssue}
              selectedTaskId={selectedTaskId}
              projects={projectOptions}
              areas={areaOptions}
            />
          ) : (
            <JqlView
              jqlMode={jqlMode}
              setJqlMode={setJqlMode}
              selectedFavoriteId={selectedFavoriteId}
              setSelectedFavoriteId={selectJqlFavorite}
              favorites={jqlFavorites}
              recentQueries={jqlRecentQueries}
              onSaveFavorite={saveJqlFavorite}
              onRenameFavorite={renameJqlFavorite}
              onDeleteFavorite={deleteJqlFavorite}
              onSelectRecent={selectJqlRecentQuery}
              results={jqlResults}
              runState={jqlRunState}
              jqlQuery={jqlQuery}
              setJqlQuery={setJqlQuery}
              jqlPrompt={jqlPrompt}
              setJqlPrompt={setJqlPrompt}
              jqlAiDraft={jqlAiDraft}
              jqlAiMessage={jqlAiMessage}
              onDraftJqlWithAi={draftJqlWithAi}
              onRunQuery={runJqlQuery}
              isDraftingJqlWithAi={isDraftingJqlWithAi}
              isRunningQuery={isRunningJqlQuery}
              queryMessage={jqlQueryMessage}
              jiraSiteUrl={appSettings.jiraSiteUrl}
              onOpenJiraIssue={openJiraIssue}
            />
          )}
        </main>

        {openPanel === "detail" && selectedTaskWithSyncLog ? (
          <TaskFocusWindow
            task={selectedTaskWithSyncLog}
            trayTasks={selectedTaskTray?.tasks ?? []}
            childTasks={selectedTaskTray?.tasks.filter((task) => task.parentTaskId === selectedTaskWithSyncLog.id) ?? []}
            projects={projectOptions}
            areas={areaOptions}
            readOnly={selectedTaskTray?.state === "Archived"}
            onUpdateDetails={trayWorkspace.updateTaskDetails}
            onUpdateRelationships={trayWorkspace.updateTaskRelationships}
            onChooseAttachmentFiles={chooseTaskAttachmentFiles}
            onUpdateAttachmentPurpose={updateTaskAttachmentPurpose}
            onDeleteAttachment={deleteTaskAttachment}
            onAddSubtask={trayWorkspace.addSubtaskToTask}
            onDeleteSubtask={trayWorkspace.deleteTask}
            onGenerateDescription={generateTaskDescription}
            onListDescriptionProposals={usesTauriPersistence ? listPersistedAssistedDescriptionProposals : undefined}
            onListDescriptionProposalLog={usesTauriPersistence ? listPersistedDescriptionProposalLog : undefined}
            onSaveDescription={trayWorkspace.saveTaskDescription}
            onCreateDescriptionProposal={usesTauriPersistence ? createPersistedAssistedDescriptionProposal : undefined}
            onRefreshTask={usesTauriPersistence ? refreshPersistedTask : undefined}
            onTransitionDescriptionProposal={usesTauriPersistence ? transitionPersistedAssistedDescriptionProposal : undefined}
            onUpdateDescriptionProposalSection={usesTauriPersistence ? updatePersistedAssistedDescriptionProposalSection : undefined}
            onOpenJiraIssue={openJiraIssue}
            onClose={() => setOpenPanel(null)}
            isGeneratingDescription={generatingDescriptionTaskId === selectedTaskWithSyncLog.id}
            proposalProvider={usesTauriPersistence ? (appSettings.aiProvider === "None" ? null : appSettings.aiProvider) : "In-memory"}
            proposalModel={usesTauriPersistence ? appSettings.aiModel : "preview"}
          />
        ) : null}
        {openPanel === "categories" ? (
          <CategoriesPanel
            projects={projectCategories}
            areas={areaCategories}
            onCreateCategory={createCategory}
            onUpdateCategory={updateCategory}
            onDeleteCategory={deleteCategory}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
        {openPanel === "settings" ? (
          <SettingsPanel
            settings={appSettings}
            hasJiraApiToken={hasJiraApiToken}
            hasAiProviderApiKey={hasAiProviderApiKey}
            jiraCredentialMessage={jiraCredentialMessage}
            aiCredentialMessage={aiCredentialMessage}
            isTestingJiraConnection={isTestingJiraConnection}
            isTestingAiProviderConnection={isTestingAiProviderConnection}
            onChange={updateAppSettings}
            onSaveJiraApiToken={saveJiraApiToken}
            onDeleteJiraApiToken={deleteJiraApiToken}
            onSaveAiProviderApiKey={saveAiProviderApiKey}
            onDeleteAiProviderApiKey={deleteAiProviderApiKey}
            onTestAiProviderConnection={testAiProviderConnection}
            onTestAiProviderApiKey={testAiProviderApiKey}
            onTestJiraConnection={testJiraConnection}
            onTestJiraApiToken={testJiraApiToken}
            onOpenJiraApiTokens={openJiraApiTokensPage}
            onOpenAiProviderApiKeys={openAiProviderApiKeysPage}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
        {trayPendingDelete ? (
          <ConfirmDialog
            {...getTrayDeleteConfirmation(trayPendingDelete)}
            onCancel={trayWorkspace.cancelDeleteTray}
            onConfirm={trayWorkspace.confirmDeleteTray}
          />
        ) : null}
        {jiraCreatePreflight ? (
          <JiraPreflightDialog
            preflight={jiraCreatePreflight}
            isCreating={isCreatingJiraIssues}
            createError={jiraCreateError}
            createResult={jiraCreateResult}
            createProgress={jiraCreateProgress}
            isCreatingRecoveryTray={isCreatingRecoveryTray}
            onCreate={createJiraParentIssues}
            onCreateRecoveryTray={createRecoveryTrayFromJiraResult}
            onClose={() => {
              setJiraCreatePreflight(null);
              setJiraCreateProgress(null);
            }}
          />
        ) : null}
        {connectionNotice ? (
          <ConnectionNoticeToast notice={connectionNotice} onClose={() => setConnectionNotice(null)} />
        ) : null}
        {backupNotice ? <BackupNoticeDialog notice={backupNotice} onClose={() => setBackupNotice(null)} /> : null}
        {jiraCreationNotice ? (
          <JiraCreationNoticeDialog
            notice={jiraCreationNotice}
            isCreatingRecoveryTray={isCreatingRecoveryTray}
            onCreateRecoveryTray={createRecoveryTrayFromJiraNotice}
            onClose={() => setJiraCreationNotice(null)}
          />
        ) : null}
        {csvExportNotice ? (
          <CsvExportNoticeToast key={csvExportNotice.id} notice={csvExportNotice} onClose={() => setCsvExportNotice(null)} />
        ) : null}
      </div>
    </div>
  );
}

function JiraCreationNoticeDialog({
  notice,
  isCreatingRecoveryTray,
  onCreateRecoveryTray,
  onClose
}: {
  notice: JiraCreationNotice;
  isCreatingRecoveryTray: boolean;
  onCreateRecoveryTray: () => void;
  onClose: () => void;
}) {
  const result = notice.result;
  const visibleMessages = result.messages.slice(0, 5);
  const hiddenMessageCount = Math.max(0, result.messages.length - visibleMessages.length);
  const hasFailedTasks = result.failedTasks.length > 0;
  const overlay = useAppOverlay({
    layer: appOverlayLayers.nestedModal,
    onDismiss: onClose,
    dismissOnEscape: false,
    dismissOnBackdrop: false,
    lockScroll: true
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#091e42]/70 px-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="jira-creation-notice-title"
      {...overlay.backdropProps}
    >
      <section
        className="w-full max-w-[620px] overflow-hidden rounded border border-[#7f5f01] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#454852] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-[#f5cd47]" size={22} />
            <div className="min-w-0">
              <h2 id="jira-creation-notice-title" className="text-base font-semibold text-[#f4f5f7]">
                Jira creation needs attention
              </h2>
              <p className="mt-1 break-words text-sm leading-relaxed text-[#b7bbc4]">
                {notice.sourceTrayName} · {formatJiraCreationResultCounts(result)}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded border border-[#7f5f01] bg-[#3f3102] px-3 py-3 text-sm leading-relaxed text-[#f5cd47]">
            {getJiraCreationNoticeGuidance(result)}
          </div>
          {visibleMessages.length ? (
            <div>
              <div className="text-xs font-semibold uppercase text-[#b7bbc4]">Result details</div>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#dfe1e6]">
                {visibleMessages.map((message, index) => (
                  <li className="break-words" key={`jira-result-message-${index}`}>
                    {message}
                  </li>
                ))}
              </ul>
              {hiddenMessageCount ? (
                <p className="mt-2 text-xs text-[#aeb3bd]">{hiddenMessageCount} more result details are available in task activity.</p>
              ) : null}
            </div>
          ) : null}
          {hasFailedTasks ? (
            <div className="rounded border border-[#5c606a] bg-[#22252a] px-3 py-3 text-sm text-[#dfe1e6]">
              <div className="font-semibold text-[#f4f5f7]">Failed tasks need recovery</div>
              <p className="mt-1 text-[#b7bbc4]">Move them to a recovery tray before retrying.</p>
            </div>
          ) : null}
          {notice.recoveryError ? (
            <div className="rounded border border-[#ae2e24] bg-[#4f1d1a] px-3 py-3 text-sm text-[#ffb8ad]">{notice.recoveryError}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#454852] px-5 py-4">
          {hasFailedTasks ? (
            <button
              className="inline-flex h-9 items-center justify-center rounded border border-[#5c606a] px-3 text-sm font-medium text-[#dfe1e6] hover:bg-[#3a3d43] disabled:pointer-events-none disabled:opacity-60"
              disabled={isCreatingRecoveryTray}
              onClick={onCreateRecoveryTray}
              type="button"
            >
              {isCreatingRecoveryTray ? "Moving..." : "Move failed tasks to recovery tray"}
            </button>
          ) : null}
          <button
            className="inline-flex h-9 items-center justify-center rounded bg-[#0052cc] px-3 text-sm font-medium text-white hover:bg-[#0747a6] disabled:pointer-events-none disabled:opacity-60"
            disabled={isCreatingRecoveryTray}
            onClick={onClose}
            type="button"
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}

function ConnectionNoticeToast({
  notice,
  onClose
}: {
  notice: ConnectionNotice;
  onClose: () => void;
}) {
  const isSuccess = notice.kind === "success";
  const overlay = useAppOverlay({
    layer: appOverlayLayers.notice,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-4"
      {...overlay.backdropProps}
    >
      <section
        className={`pointer-events-auto rounded border px-4 py-3 shadow-2xl ${
          isSuccess
            ? "border-[#abf5d1] bg-[#e3fcef] text-[#006644]"
            : "border-[#ffbdad] bg-[#ffebe6] text-[#bf2600]"
        }`}
        {...overlay.surfaceProps}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{isSuccess ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{notice.title}</div>
            <p className="mt-0.5 break-words text-sm leading-relaxed">{notice.message}</p>
            {notice.detail ? <p className="mt-1 break-words text-xs leading-relaxed opacity-80">{notice.detail}</p> : null}
          </div>
          <button
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-black/10"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

function CsvExportNoticeToast({
  notice,
  onClose
}: {
  notice: CsvExportNotice;
  onClose: () => void;
}) {
  const taskLabel = notice.taskCount === 1 ? "task" : "tasks";
  const overlay = useAppOverlay({
    layer: appOverlayLayers.centeredNotice,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center px-4"
      {...overlay.backdropProps}
      role="status"
      aria-live="polite"
    >
      <section
        className="pointer-events-auto w-full max-w-[580px] rounded border border-[#216e4e] bg-[#143c2b] text-[#dffcf0] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 gap-4">
            <CheckCircle2 className="mt-0.5 shrink-0 text-[#7ee2a8]" size={30} />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#f4fff9]">CSV export complete</h2>
              <p className="mt-2 break-words text-base leading-relaxed text-[#baf3d2]">
                {notice.taskCount} {taskLabel} from <span className="font-medium text-[#f4fff9]">"{notice.trayName}"</span> saved to{" "}
                <span className="break-all font-medium text-[#f4fff9]">{notice.fileName}</span>.
              </p>
              <p className="mt-2 text-sm text-[#9ddfbc]">Exportable tasks are marked Exported.</p>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#dffcf0] hover:bg-[#216e4e]"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

function BackupNoticeDialog({
  notice,
  onClose
}: {
  notice: BackupOperationNotice;
  onClose: () => void;
}) {
  const isSuccess = notice.kind === "success";
  const visiblePrimaryCounts = getVisibleBackupCounts(notice.primaryCounts);
  const visibleSecondaryCounts = getVisibleBackupCounts(notice.secondaryCounts);
  const overlay = useAppOverlay({
    layer: appOverlayLayers.modal,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    lockScroll: true
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 px-4 backdrop-blur-[1px]"
      {...overlay.backdropProps}
    >
      <section
        className="w-full max-w-[520px] rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#454852] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${isSuccess ? "text-[#57d9a3]" : "text-[#ff8f73]"}`}>
              {isSuccess ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f4f5f7]">{notice.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#b7bbc4]">{notice.summary}</p>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#dfe1e6] hover:bg-[#3a3d43]"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          {visiblePrimaryCounts.length ? (
            <BackupCountGrid title={notice.title === "Backup imported" ? "Imported" : "Exported"} counts={visiblePrimaryCounts} />
          ) : null}
          {visibleSecondaryCounts.length ? <BackupCountGrid title="Skipped existing" counts={visibleSecondaryCounts} muted /> : null}
          {notice.warnings?.length ? (
            <div className="mt-4 rounded border border-[#665245] bg-[#3b302b] px-3 py-2 text-sm leading-relaxed text-[#ffd2bd]">
              {notice.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-[#454852] px-5 py-4">
          <button
            className="inline-flex h-8 items-center justify-center rounded bg-[#0052cc] px-3 text-sm font-medium text-white hover:bg-[#0747a6]"
            onClick={onClose}
            type="button"
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}

function BackupCountGrid({
  title,
  counts,
  muted = false
}: {
  title: string;
  counts: Array<{ label: string; count: number }>;
  muted?: boolean;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <div className={`mb-2 text-xs font-semibold uppercase ${muted ? "text-[#8993a4]" : "text-[#b3d4ff]"}`}>{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {counts.map(({ label, count }) => (
          <div className={`rounded border px-3 py-2 text-sm ${muted ? "border-[#454852] bg-[#22252a] text-[#b7bbc4]" : "border-[#3f5f8f] bg-[#1f2f4d] text-[#dbeafe]"}`} key={label}>
            <span className="font-semibold text-[#f4f5f7]">{count}</span> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  details = [],
  confirmLabel,
  requiredConfirmationText,
  onCancel,
  onConfirm
}: {
  title: string;
  message: string;
  details?: string[];
  confirmLabel: string;
  requiredConfirmationText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmationText, setConfirmationText] = useState("");
  const canConfirm = !requiredConfirmationText || confirmationText === requiredConfirmationText;
  const overlay = useAppOverlay({
    layer: appOverlayLayers.modal,
    onDismiss: onCancel,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    lockScroll: true
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 px-4 backdrop-blur-[1px]"
      {...overlay.backdropProps}
    >
      <section
        className="w-full max-w-[440px] rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="border-b border-[#454852] px-5 py-4">
          <h2 className="text-base font-semibold text-[#f4f5f7]">{title}</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-[#b7bbc4]">{message}</p>
          {details.length ? (
            <ul className="mt-3 space-y-1 text-sm text-[#b7bbc4]">
              {details.map((detail) => (
                <li className="flex gap-2" key={detail}>
                  <span className="text-[#ff9c8f]">-</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {requiredConfirmationText ? (
            <label className="mt-4 block text-sm text-[#b7bbc4]">
              Type <span className="font-semibold text-[#f4f5f7]">{requiredConfirmationText}</span> to confirm.
              <input
                autoFocus
                className="mt-2 h-9 w-full rounded border border-[#5c606a] bg-[#22252a] px-3 text-sm text-[#f4f5f7] outline-none focus:border-[#85b8ff] focus:ring-2 focus:ring-[#1d355c]"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#454852] px-5 py-4">
          <button
            className="inline-flex h-8 items-center justify-center rounded px-3 text-sm font-medium text-[#dfe1e6] hover:bg-[#3a3d43]"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-8 items-center justify-center rounded bg-[#de350b] px-3 text-sm font-medium text-white hover:bg-[#bf2600] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canConfirm}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function getTrayDeleteConfirmation(tray: Tray): {
  title: string;
  message: string;
  details: string[];
  confirmLabel: string;
  requiredConfirmationText?: string;
} {
  const counts = countTasksBySyncStatus(tray.tasks);
  const createdCount = counts.Created;
  const localOnlyCount = counts.Pending + counts.Failed + counts.Exported;
  const taskLabel = tray.tasks.length === 1 ? "task" : "tasks";
  const details = [
    `${tray.tasks.length} local ${taskLabel} will be removed from this app.`,
    createdCount ? `${createdCount} created Jira ${createdCount === 1 ? "issue link" : "issue links"} will be removed locally.` : null,
    localOnlyCount ? `${localOnlyCount} pending, failed, or exported local ${localOnlyCount === 1 ? "task" : "tasks"} will be removed.` : null,
    "Jira issues themselves will not be deleted."
  ].filter(Boolean) as string[];

  if (createdCount > 0) {
    return {
      title: "Delete tray with Jira history?",
      message: `Deleting "${tray.name}" removes local history and Jira links from this app.`,
      details,
      confirmLabel: "Delete tray",
      requiredConfirmationText: "DELETE"
    };
  }

  if (tray.tasks.length > 0) {
    return {
      title: "Delete local tray?",
      message: `Delete "${tray.name}" and its local tasks?`,
      details,
      confirmLabel: "Delete tray"
    };
  }

  return {
    title: "Delete empty tray?",
    message: `Delete "${tray.name}" from local app data?`,
    details: [],
    confirmLabel: "Delete tray"
  };
}

function createPreviewAssistedDescription(task: LocalTask, additionalContext: string): AssistedDescriptionDraft {
  const context = additionalContext.trim();
  if (!context && task.title.trim().split(/\s+/).filter(Boolean).length <= 4) {
    return {
      status: "needs_clarification",
      clarificationQuestions: [
        "Que usuario o persona se ve afectado, y que necesita lograr?",
        "Que debe cambiar, incluyendo lo mas importante dentro y fuera de alcance?",
        "Como debe validar el exito QA, Arte, Programacion u otro responsable?"
      ]
    };
  }

  return {
    status: "drafted",
    clarificationQuestions: [],
    description: serializeAssistedDescriptionSections({
      ...createEmptyAssistedDescriptionSections(),
      user_story: `Como usuario de ${task.project},\nquiero ${task.title},\npara obtener un resultado claro y validable.`,
      problem: context || "Contexto pendiente de revisar con el responsable antes de crear la tarea en Jira.",
      objective: `Preparar una tarea ${task.area} clara, validable y lista para Jira.`,
      scope: [
        "Incluye:",
        `- Preparar la tarea ${task.area} descrita en el titulo.`,
        "- Validar el resultado esperado con el responsable del area.",
        "",
        "No incluye:",
        "- Cambios fuera del alcance confirmado para esta tarea."
      ].join("\n"),
      out_of_scope: "Cambios no confirmados por el responsable del area.",
      main_flows: "- Revisar el contexto.\n- Implementar o preparar el cambio.\n- Validar el resultado esperado.",
      functional_requirements: `- La tarea ${task.area} debe quedar descrita con acciones verificables.`,
      nonfunctional_requirements: "- Mantener el alcance acotado y comprensible para revision.",
      constraints_dependencies: "- Confirmar dependencias si aparecen durante la implementacion.",
      acceptance_criteria: [
        "- La tarea queda implementada o preparada segun el alcance confirmado.",
        "- El responsable puede validar el resultado sin informacion adicional critica."
      ].join("\n"),
      risks_questions: "- Alcance incompleto si el titulo no captura restricciones o casos borde."
    })
  };
}

function isTaskDescriptionCommandUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /generate_task_description|unknown command|command .*not found|not implemented/i.test(message);
}

async function waitForNextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForMinimumElapsed(startedAt: number, minimumMs: number): Promise<void> {
  const remainingMs = minimumMs - (performance.now() - startedAt);
  if (remainingMs <= 0) return;

  await new Promise((resolve) => setTimeout(resolve, remainingMs));
}

function countJiraApiCreateableTasks(
  tasks: LocalTask[],
  includeExportedTasks: boolean,
  includeMissingDescriptionTasks: boolean
): number {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  return tasks.filter((task) => {
    if (task.syncStatus === "Created") return false;
    if (!includeExportedTasks && task.syncStatus === "Exported") return false;
    if (!includeMissingDescriptionTasks && !isSubtask(task) && task.descriptionStatus === "Missing") return false;
    if (!isSubtask(task) || !task.parentTaskId) return true;

    const parentTask = tasksById.get(task.parentTaskId);
    if (!parentTask || parentTask.syncStatus === "Created") return true;
    if (!includeExportedTasks && parentTask.syncStatus === "Exported") return false;
    if (!includeMissingDescriptionTasks && parentTask.descriptionStatus === "Missing") return false;

    return true;
  }).length;
}

function toFileSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tray";
}

async function getDefaultCsvExportPath(filename: string): Promise<string | undefined> {
  try {
    const defaultPath = await join(await downloadDir(), filename);
    return isAbsoluteFilePath(defaultPath) ? defaultPath : undefined;
  } catch {
    return undefined;
  }
}

function isAbsoluteFilePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function getFileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
