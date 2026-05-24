import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { downloadDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { AppHeader } from "./components/shell";
import { CategoriesPanel } from "./features/categories";
import { JiraPreflightDialog, type JiraCreatePreflight } from "./features/jira-preflight";
import { JqlView } from "./features/jql";
import { SettingsPanel } from "./features/settings";
import { TaskFocusWindow } from "./features/task-detail";
import { TraysView } from "./features/trays";
import { mockAppDataAdapter } from "./lib/adapters";
import {
  archivePersistedTray,
  createPersistedJiraParentIssues,
  createPersistedRecoveryTrayFromTasks,
  createPersistedTask,
  createPersistedTray,
  deletePersistedJiraApiToken,
  deletePersistedTray,
  deletePersistedTask,
  getPersistedAppSettings,
  hasPersistedJiraApiToken,
  listPersistedTrays,
  markPersistedTasksCsvExported,
  openPersistedAtlassianApiTokensPage,
  renamePersistedTray,
  restorePersistedTray,
  runPersistedJqlQuery,
  saveCsvFile,
  savePersistedJiraApiToken,
  testPersistedJiraConnection,
  updatePersistedAppSettings,
  updatePersistedTaskDetails
} from "./lib/adapters/tauriPersistence";
import {
  canDeleteTask,
  canDuplicateTask,
  classifyTrayPreflightWarnings,
  countCsvExportableTasks,
  deriveIssueTypeFromArea,
  deriveTrayStateFromTasks,
  duplicateLocalTask,
  exportLocalTasksToCsv,
  isEligibleForCsvExport
} from "./lib/domain";
import type {
  AppSettings,
  JiraConnectionTestResult,
  JiraCreateIssuesResult,
  LocalTask,
  MainTab,
  Panel,
  Priority,
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
const generatedJqlPreview =
  'project = DTS AND labels = "Bug" AND priority in (High, Highest) AND statusCategory != Done ORDER BY priority DESC';
const defaultJqlPrompt = "Show me high and highest open bugs for STT, sorted by priority";
const atlassianApiTokensUrl = "https://id.atlassian.com/manage-profile/security/api-tokens";

export default function App() {
  const taskIdCounter = useRef(0);
  const [trays, setTrays] = useState<Tray[]>(() => cloneTrays(appData.listTrays()));
  const [activeTab, setActiveTab] = useState<MainTab>("trays");
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("ltask-timer");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState(appData.listJqlFavorites()[0]?.id);
  const [jqlMode, setJqlMode] = useState<"direct" | "ai">("ai");
  const [jqlQuery, setJqlQuery] = useState(appData.listJqlFavorites()[0]?.jql ?? "");
  const [jqlPrompt, setJqlPrompt] = useState(defaultJqlPrompt);
  const [jqlResults, setJqlResults] = useState(() => appData.listJqlResults());
  const [jqlQueryMessage, setJqlQueryMessage] = useState<string | null>(null);
  const [isRunningJqlQuery, setIsRunningJqlQuery] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [usesTauriPersistence, setUsesTauriPersistence] = useState(false);
  const [showArchivedTrays, setShowArchivedTrays] = useState(false);
  const [trayPendingDelete, setTrayPendingDelete] = useState<Tray | null>(null);
  const [csvExportMessage, setCsvExportMessage] = useState<string | null>(null);
  const [hasJiraApiToken, setHasJiraApiToken] = useState(false);
  const [jiraCredentialMessage, setJiraCredentialMessage] = useState<string | null>(null);
  const [jiraConnectionResult, setJiraConnectionResult] = useState<JiraConnectionTestResult | null>(null);
  const [isTestingJiraConnection, setIsTestingJiraConnection] = useState(false);
  const [isRunningJiraPreflight, setIsRunningJiraPreflight] = useState(false);
  const [jiraCreatePreflight, setJiraCreatePreflight] = useState<JiraCreatePreflight | null>(null);
  const [isCreatingJiraIssues, setIsCreatingJiraIssues] = useState(false);
  const [isCreatingRecoveryTray, setIsCreatingRecoveryTray] = useState(false);
  const [jiraCreateResult, setJiraCreateResult] = useState<JiraCreateIssuesResult | null>(null);
  const [jiraCreateError, setJiraCreateError] = useState<string | null>(null);
  const lastSelectedTrayId = useRef<string | null>(null);

  const selectedTray = useMemo(
    () => trays.find((tray) => tray.id === selectedTrayId) ?? null,
    [selectedTrayId, trays]
  );

  const selectedTask = useMemo(() => {
    return trays.flatMap((tray) => tray.tasks).find((task) => task.id === selectedTaskId) ?? null;
  }, [selectedTaskId, trays]);

  const selectedTaskTray = useMemo(() => {
    if (!selectedTaskId) return null;
    return trays.find((tray) => tray.tasks.some((task) => task.id === selectedTaskId)) ?? null;
  }, [selectedTaskId, trays]);

  const visibleTrays = useMemo(
    () => trays.filter((tray) => (showArchivedTrays ? tray.state === "Archived" : tray.state !== "Archived")),
    [showArchivedTrays, trays]
  );
  const projectOptions = useMemo(() => appData.listProjects().filter((project) => !project.hidden).map((project) => project.name), []);
  const areaOptions = useMemo(() => appData.listAreas().filter((area) => !area.hidden).map((area) => area.name), []);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([listPersistedTrays(), getPersistedAppSettings(), hasPersistedJiraApiToken()])
      .then(([persistedTrays, persistedSettings, hasPersistedToken]) => {
        if (!isCurrent) return;
        setUsesTauriPersistence(true);
        setTrays(persistedTrays);
        setAppSettings(persistedSettings);
        setHasJiraApiToken(hasPersistedToken);
        setSelectedTrayId((currentTrayId) =>
          currentTrayId && persistedTrays.some((tray) => tray.id === currentTrayId) ? currentTrayId : null
        );
        setSelectedTaskId((currentTaskId) =>
          currentTaskId && persistedTrays.some((tray) => tray.tasks.some((task) => task.id === currentTaskId))
            ? currentTaskId
            : null
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
    if (openPanel !== "detail") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openPanel]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updatePreference = () => setSystemPrefersDark(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const resolvedTheme = appSettings.themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : appSettings.themeMode;

  useEffect(() => {
    if (openPanel === "detail" && !selectedTask) {
      setOpenPanel(null);
    }
  }, [openPanel, selectedTask]);

  useEffect(() => {
    setCsvExportMessage(null);
  }, [selectedTrayId]);

  function openTask(task: LocalTask) {
    setSelectedTaskId(task.id);
    setOpenPanel("detail");
  }

  function openTray(tray: Tray) {
    lastSelectedTrayId.current = tray.id;
    setSelectedTrayId(tray.id);
    setActiveTab("trays");
    const firstTask = tray.tasks[0];
    if (firstTask) setSelectedTaskId(firstTask.id);
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
  }

  function nextTaskId() {
    taskIdCounter.current += 1;
    return `ltask-local-${Date.now().toString(36)}-${taskIdCounter.current}`;
  }

  async function createTray() {
    const trayName = "New tray";
    const nextTray = usesTauriPersistence
      ? await createPersistedTray(trayName)
      : {
          id: `tray-local-${Date.now().toString(36)}`,
          name: trayName,
          state: "Active" as const,
          summary: "No tasks",
          updatedAt: "Just now",
          tasks: []
        };

    setTrays((currentTrays) => [nextTray, ...currentTrays]);
    lastSelectedTrayId.current = nextTray.id;
    setSelectedTrayId(nextTray.id);
    setSelectedTaskId(null);
  }

  async function renameTray(trayId: string, name: string) {
    const persistedTray = usesTauriPersistence ? await renamePersistedTray(trayId, name) : null;
    setTrays((currentTrays) =>
      currentTrays.map((tray) =>
        tray.id === trayId
          ? {
              ...tray,
              name: persistedTray?.name ?? name,
              state: persistedTray?.state ?? tray.state,
              updatedAt: persistedTray?.updatedAt ?? "Just now"
            }
          : tray
      )
    );
  }

  async function archiveTray(trayId: string) {
    const persistedTray = usesTauriPersistence ? await archivePersistedTray(trayId) : null;
    setTrays((currentTrays) =>
      currentTrays.map((tray) =>
        tray.id === trayId
          ? {
              ...tray,
              state: persistedTray?.state ?? "Archived",
              updatedAt: persistedTray?.updatedAt ?? "Just now"
            }
          : tray
      )
    );
  }

  async function restoreTray(trayId: string) {
    const persistedTray = usesTauriPersistence ? await restorePersistedTray(trayId) : null;
    setTrays((currentTrays) =>
      currentTrays.map((tray) =>
        tray.id === trayId
          ? {
              ...tray,
              state: persistedTray?.state ?? "Active",
              updatedAt: persistedTray?.updatedAt ?? "Just now"
            }
          : tray
      )
    );
  }

  async function deleteTray(trayId: string) {
    const tray = trays.find((candidate) => candidate.id === trayId);
    if (!tray) return;
    setTrayPendingDelete(tray);
  }

  async function confirmDeleteTray() {
    if (!trayPendingDelete) return;
    const trayId = trayPendingDelete.id;
    if (usesTauriPersistence) {
      const deleted = await deletePersistedTray(trayId);
      if (!deleted) return;
    }

    setTrays((currentTrays) => currentTrays.filter((candidate) => candidate.id !== trayId));
    if (selectedTrayId === trayId) setSelectedTrayId(null);
    if (lastSelectedTrayId.current === trayId) lastSelectedTrayId.current = null;
    setTrayPendingDelete(null);
  }

  async function addTaskToSelectedTray(taskInput: { project: string; area: string; title: string; priority: Priority }) {
    if (!selectedTrayId) return;

    const draftTask: LocalTask = {
      id: nextTaskId(),
      project: taskInput.project,
      area: taskInput.area,
      title: taskInput.title,
      priority: taskInput.priority,
      issueType: deriveIssueTypeFromArea(taskInput.area),
      syncStatus: "Pending",
      descriptionStatus: "Missing",
      language: "Spanish"
    };
    const nextTask = usesTauriPersistence ? await createPersistedTask(draftTask, selectedTrayId) : draftTask;

    setTrays((currentTrays) =>
      currentTrays.map((tray) =>
        tray.id === selectedTrayId ? updateTrayTasks(tray, [...tray.tasks, nextTask]) : tray
      )
    );
    setSelectedTaskId(nextTask.id);
  }

  async function duplicateTask(taskId: string) {
    const sourceTray = trays.find((tray) => tray.tasks.some((task) => task.id === taskId));
    const sourceTask = sourceTray?.tasks.find((task) => task.id === taskId);
    if (!sourceTray || !sourceTask || !canDuplicateTask(sourceTask)) return;

    const duplicate = duplicateLocalTask(sourceTask, nextTaskId());
    const persistedDuplicate = usesTauriPersistence ? await createPersistedTask(duplicate, sourceTray.id) : duplicate;

    setTrays((currentTrays) =>
      currentTrays.map((tray) => {
        const taskIndex = tray.tasks.findIndex((task) => task.id === taskId);
        if (taskIndex === -1) return tray;

        const nextTasks = [...tray.tasks];
        nextTasks.splice(taskIndex + 1, 0, persistedDuplicate);
        return updateTrayTasks(tray, nextTasks);
      })
    );
    setSelectedTaskId(persistedDuplicate.id);
  }

  async function deleteTask(taskId: string) {
    const tray = trays.find((candidate) => candidate.tasks.some((task) => task.id === taskId));
    const task = tray?.tasks.find((candidate) => candidate.id === taskId);
    if (!tray || !task || !canDeleteTask(task)) return;
    if (usesTauriPersistence) {
      const deleted = await deletePersistedTask(taskId);
      if (!deleted) return;
    }

    if (selectedTaskId === taskId) {
      const taskIndex = tray.tasks.findIndex((candidate) => candidate.id === taskId);
      const replacementTask = tray.tasks[taskIndex + 1] ?? tray.tasks[taskIndex - 1] ?? null;
      setSelectedTaskId(replacementTask?.id ?? null);
      if (!replacementTask) setOpenPanel(null);
    }

    setTrays((currentTrays) =>
      currentTrays.map((candidate) =>
        candidate.id === tray.id ? updateTrayTasks(candidate, candidate.tasks.filter((candidateTask) => candidateTask.id !== taskId)) : candidate
      )
    );
  }

  async function updateTaskDetails(
    taskId: string,
    taskInput: Partial<Pick<LocalTask, "area" | "issueType" | "priority" | "project" | "title">>
  ) {
    const tray = trays.find((candidate) => candidate.tasks.some((task) => task.id === taskId));
    const task = tray?.tasks.find((candidate) => candidate.id === taskId);
    if (!tray || !task || tray.state === "Archived" || task.syncStatus === "Created") return;

    const nextTitle = taskInput.title !== undefined ? taskInput.title.trim() : task.title;
    if (!nextTitle) return;

    const nextArea = taskInput.area ?? task.area;
    const shouldDeriveIssueType = taskInput.area !== undefined && taskInput.issueType === undefined;
    const nextTask: LocalTask = {
      ...task,
      project: taskInput.project ?? task.project,
      area: nextArea,
      title: nextTitle,
      priority: taskInput.priority ?? task.priority,
      issueType: shouldDeriveIssueType ? deriveIssueTypeFromArea(nextArea) : (taskInput.issueType ?? task.issueType)
    };
    const persistedTask = usesTauriPersistence
      ? await updatePersistedTaskDetails(taskId, nextTask)
      : nextTask;

    if (!persistedTask) return;

    setTrays((currentTrays) =>
      currentTrays.map((candidate) =>
        candidate.id === tray.id
          ? updateTrayTasks(
              candidate,
              candidate.tasks.map((candidateTask) => (candidateTask.id === taskId ? persistedTask : candidateTask))
            )
          : candidate
      )
    );
  }

  async function updateAppSettings(settingsPatch: Partial<AppSettings>) {
    const previousSettings = appSettings;
    const nextSettings = {
      ...appSettings,
      ...settingsPatch
    };

    setAppSettings(nextSettings);
    if (!usesTauriPersistence) return;

    try {
      const persistedSettings = await updatePersistedAppSettings(nextSettings);
      setAppSettings(persistedSettings);
    } catch {
      setAppSettings(previousSettings);
    }
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

  async function saveJiraApiToken(token: string) {
    if (!token.trim()) {
      setJiraCredentialMessage("Token cannot be empty.");
      return false;
    }

    try {
      await savePersistedJiraApiToken(token);
      setHasJiraApiToken(true);
      setJiraCredentialMessage("Jira API token saved in the OS credential store.");
      setJiraConnectionResult(null);
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
      setJiraConnectionResult(null);
    } catch {
      setJiraCredentialMessage("Could not remove Jira API token.");
    }
  }

  async function testJiraConnection() {
    setIsTestingJiraConnection(true);
    setJiraConnectionResult(null);

    try {
      const result = await testPersistedJiraConnection();
      setJiraConnectionResult(result);
    } catch (error) {
      setJiraConnectionResult({
        ok: false,
        message: error instanceof Error ? error.message : "Could not test Jira connection."
      });
    } finally {
      setIsTestingJiraConnection(false);
    }
  }

  function selectJqlFavorite(favoriteId: string) {
    const favorite = appData.listJqlFavorites().find((candidate) => candidate.id === favoriteId);
    setSelectedFavoriteId(favoriteId);
    if (favorite) {
      setJqlQuery(favorite.jql);
      setJqlMode("direct");
      setJqlQueryMessage(null);
    }
  }

  async function runJqlQuery() {
    const query = jqlMode === "ai" ? generatedJqlPreview : jqlQuery.trim();
    if (!query) {
      setJqlResults([]);
      setJqlQueryMessage("JQL query is required.");
      return;
    }

    setIsRunningJqlQuery(true);
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
      setJqlQueryMessage(formatJqlQueryMessage(queryResult.results.length, queryResult.isLast, queryResult.warningMessages));
    } catch (error) {
      setJqlResults([]);
      setJqlQueryMessage(formatJqlQueryError(error));
    } finally {
      await waitForMinimumElapsed(loadingStartedAt, 1000);
      setIsRunningJqlQuery(false);
    }
  }

  async function exportTrayCsv(tray: Tray) {
    const csvExportOptions = { includeExported: true };
    const exportableTasks = tray.tasks.filter((task) => isEligibleForCsvExport(task, csvExportOptions));
    const exportableCount = countCsvExportableTasks(tray.tasks, csvExportOptions);
    if (exportableCount === 0) {
      setCsvExportMessage("No pending, failed, or exported tasks to export.");
      return;
    }

    const csv = exportLocalTasksToCsv(tray.tasks, { includeExported: true });
    const defaultFilename = `${toFileSlug(tray.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
    const defaultPath = await getDefaultCsvExportPath(defaultFilename);
    const path = await save({
      defaultPath,
      filters: [
        {
          name: "CSV",
          extensions: ["csv"]
        }
      ]
    });

    if (!path) {
      setCsvExportMessage("CSV export cancelled.");
      return;
    }

    try {
      await saveCsvFile(path, `\uFEFF${csv}`);
    } catch {
      setCsvExportMessage("CSV could not be saved.");
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

      setTrays((currentTrays) =>
        currentTrays.map((currentTray) => {
          if (currentTray.id !== tray.id) return currentTray;

          const nextTasks = currentTray.tasks.map((task) => exportedTasksById.get(task.id) ?? task);
          return updateTrayTasks(currentTray, nextTasks);
        })
      );
    } catch {
      setCsvExportMessage("CSV downloaded, but task status could not be updated.");
      return;
    }

    setCsvExportMessage(`${exportableCount} ${exportableCount === 1 ? "task" : "tasks"} exported to CSV.`);
  }

  async function createInJiraPreflight(tray: Tray) {
    setIsRunningJiraPreflight(true);
    setJiraCreateResult(null);
    setJiraCreateError(null);
    const loadingStartedAt = performance.now();
    await waitForNextPaint();

    const warnings = classifyTrayPreflightWarnings(tray.tasks);
    const createableTaskCount = tray.tasks.filter((task) => task.syncStatus !== "Created" && task.issueType !== "Sub-task").length;
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
      setJiraConnectionResult(credentialResult);
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

  async function createJiraParentIssues(options: { allowMissingDescriptions: boolean }) {
    if (!jiraCreatePreflight || !usesTauriPersistence) return;

    flushSync(() => {
      setIsCreatingJiraIssues(true);
      setJiraCreateResult(null);
      setJiraCreateError(null);
    });
    let shouldClosePreflight = false;
    let nextCreateResult: JiraCreateIssuesResult | null = null;
    let nextCreateError: string | null = null;
    await waitForNextPaint();
    await delay(1000);

    try {
      const result = await createPersistedJiraParentIssues(
        jiraCreatePreflight.tray.id,
        options.allowMissingDescriptions
      );
      const persistedTrays = await listPersistedTrays();
      setTrays(persistedTrays);
      setSelectedTrayId((currentTrayId) =>
        currentTrayId && persistedTrays.some((tray) => tray.id === currentTrayId)
          ? currentTrayId
          : jiraCreatePreflight.tray.id
      );
      setSelectedTaskId((currentTaskId) =>
        currentTaskId && persistedTrays.some((tray) => tray.tasks.some((task) => task.id === currentTaskId))
          ? currentTaskId
          : null
      );
      if (result.status === "succeeded" && result.failedIssueCount === 0) {
        shouldClosePreflight = true;
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
      } else {
        if (nextCreateResult) setJiraCreateResult(nextCreateResult);
        if (nextCreateError) setJiraCreateError(nextCreateError);
      }
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
      setTrays(persistedTrays);
      setSelectedTrayId(recoveryTray.id);
      setSelectedTaskId(persistedTrays.find((tray) => tray.id === recoveryTray.id)?.tasks[0]?.id ?? null);
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
          lastSelectedTrayId.current = selectedTrayId;
          setSelectedTrayId(null);
        }
      }

      if (event.button === 4 && !selectedTrayId && lastSelectedTrayId.current) {
        const tray = trays.find((candidate) => candidate.id === lastSelectedTrayId.current);
        if (tray) openTray(tray);
      }
    }

    window.addEventListener("mouseup", handleSecondaryMouseNavigation);
    return () => window.removeEventListener("mouseup", handleSecondaryMouseNavigation);
  }, [openPanel, selectedTrayId, trays]);

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
              onCreateTray={createTray}
              onRenameTray={renameTray}
              onArchiveTray={archiveTray}
              onRestoreTray={restoreTray}
              onDeleteTray={deleteTray}
              onExportCsv={exportTrayCsv}
              onCreateInJira={createInJiraPreflight}
              csvExportMessage={csvExportMessage}
              isRunningJiraPreflight={isRunningJiraPreflight}
              showArchived={showArchivedTrays}
              onToggleArchived={() => setShowArchivedTrays((current) => !current)}
              onBackToSelector={() => {
                setShowArchivedTrays(false);
                setSelectedTrayId(null);
              }}
              onOpenTask={openTask}
              onAddTask={addTaskToSelectedTray}
              onUpdateTask={updateTaskDetails}
              onDuplicateTask={duplicateTask}
              onDeleteTask={deleteTask}
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
              favorites={appData.listJqlFavorites()}
              results={jqlResults}
              jqlQuery={jqlQuery}
              setJqlQuery={setJqlQuery}
              jqlPrompt={jqlPrompt}
              setJqlPrompt={setJqlPrompt}
              generatedJqlPreview={generatedJqlPreview}
              onRunQuery={runJqlQuery}
              isRunningQuery={isRunningJqlQuery}
              queryMessage={jqlQueryMessage}
            />
          )}
        </main>

        {openPanel === "detail" && selectedTask ? (
          <TaskFocusWindow
            task={selectedTask}
            projects={projectOptions}
            areas={areaOptions}
            readOnly={selectedTaskTray?.state === "Archived"}
            onUpdateDetails={updateTaskDetails}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
        {openPanel === "categories" ? (
          <CategoriesPanel
            projects={appData.listProjects()}
            areas={appData.listAreas()}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
        {openPanel === "settings" ? (
          <SettingsPanel
            settings={appSettings}
            hasJiraApiToken={hasJiraApiToken}
            jiraCredentialMessage={jiraCredentialMessage}
            jiraConnectionResult={jiraConnectionResult}
            isTestingJiraConnection={isTestingJiraConnection}
            onChange={updateAppSettings}
            onSaveJiraApiToken={saveJiraApiToken}
            onDeleteJiraApiToken={deleteJiraApiToken}
            onTestJiraConnection={testJiraConnection}
            onOpenJiraApiTokens={openJiraApiTokensPage}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
        {trayPendingDelete ? (
          <ConfirmDialog
            {...getTrayDeleteConfirmation(trayPendingDelete)}
            onCancel={() => setTrayPendingDelete(null)}
            onConfirm={confirmDeleteTray}
          />
        ) : null}
        {jiraCreatePreflight ? (
          <JiraPreflightDialog
            preflight={jiraCreatePreflight}
            isCreating={isCreatingJiraIssues}
            createError={jiraCreateError}
            createResult={jiraCreateResult}
            isCreatingRecoveryTray={isCreatingRecoveryTray}
            onCreate={createJiraParentIssues}
            onCreateRecoveryTray={createRecoveryTrayFromJiraResult}
            onClose={() => setJiraCreatePreflight(null)}
          />
        ) : null}
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

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 px-4 backdrop-blur-[1px]" onMouseDown={onCancel}>
      <section
        className="w-full max-w-[440px] rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
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

function cloneTrays(trays: Tray[]): Tray[] {
  return trays.map((tray) => ({
    ...tray,
    tasks: tray.tasks.map((task) => ({
      ...task,
      attachments: task.attachments?.map((attachment) => ({ ...attachment })),
      syncLog: task.syncLog?.map((entry) => ({ ...entry })),
      subtasks: task.subtasks ? [...task.subtasks] : undefined
    }))
  }));
}

function updateTrayTasks(tray: Tray, tasks: LocalTask[]): Tray {
  return {
    ...tray,
    tasks,
    state: deriveTrayStateFromTasks(tasks, tray.state),
    summary: summarizeTrayTasks(tasks),
    updatedAt: "Just now"
  };
}

function summarizeTrayTasks(tasks: LocalTask[]): string {
  if (tasks.length === 0) return "No tasks";

  const counts = countTasksBySyncStatus(tasks);

  return [
    `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
    counts.Pending ? `${counts.Pending} pending` : null,
    counts.Failed ? `${counts.Failed} failed` : null,
    counts.Exported ? `${counts.Exported} exported` : null,
    counts.Created ? `${counts.Created} created` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatJqlQueryMessage(resultCount: number, isLast: boolean, warningMessages: string[]): string {
  if (resultCount === 0) {
    const warningText = warningMessages.length ? ` ${warningMessages.join(" ")}` : "";
    return `No issues matched this JQL query.${warningText}`;
  }

  const resultText = `${resultCount} ${resultCount === 1 ? "issue" : "issues"} returned.`;
  const pageText = isLast ? null : "More results are available in Jira.";
  const warningText = warningMessages.length ? warningMessages.join(" ") : null;

  return [resultText, pageText, warningText].filter(Boolean).join(" ");
}

function formatJqlQueryError(error: unknown): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "Could not run JQL query.";
  return `JQL query failed. ${message}`;
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

function countTasksBySyncStatus(tasks: LocalTask[]): Record<LocalTask["syncStatus"], number> {
  return tasks.reduce(
    (summary, task) => {
      summary[task.syncStatus] += 1;
      return summary;
    },
    { Pending: 0, Failed: 0, Exported: 0, Created: 0 } satisfies Record<LocalTask["syncStatus"], number>
  );
}

function toFileSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "tray";
}

async function getDefaultCsvExportPath(filename: string): Promise<string> {
  try {
    return await join(await downloadDir(), filename);
  } catch {
    return filename;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
