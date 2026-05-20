import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./components/shell";
import { CategoriesPanel } from "./features/categories";
import { JqlView } from "./features/jql";
import { SettingsPanel } from "./features/settings";
import { TaskFocusWindow } from "./features/task-detail";
import { TraysView } from "./features/trays";
import { mockAppDataAdapter } from "./lib/adapters";
import { createPersistedTask, createPersistedTray, deletePersistedTask, listPersistedTrays } from "./lib/adapters/tauriPersistence";
import { canDeleteTask, canDuplicateTask, deriveIssueTypeFromArea, deriveTrayStateFromTasks, duplicateLocalTask } from "./lib/domain";
import type { LocalTask, MainTab, Panel, Priority, Tray } from "./lib/types";
import { cn } from "./lib/utils";

const appData = mockAppDataAdapter;

export default function App() {
  const taskIdCounter = useRef(0);
  const [trays, setTrays] = useState<Tray[]>(() => cloneTrays(appData.listTrays()));
  const [activeTab, setActiveTab] = useState<MainTab>("trays");
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("ltask-timer");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState(appData.listJqlFavorites()[0]?.id);
  const [jqlMode, setJqlMode] = useState<"direct" | "ai">("ai");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("dark");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [usesTauriPersistence, setUsesTauriPersistence] = useState(false);

  const selectedTray = useMemo(
    () => trays.find((tray) => tray.id === selectedTrayId) ?? null,
    [selectedTrayId, trays]
  );

  const selectedTask = useMemo(() => {
    return trays.flatMap((tray) => tray.tasks).find((task) => task.id === selectedTaskId) ?? null;
  }, [selectedTaskId, trays]);

  const activeTrays = useMemo(() => trays.filter((tray) => tray.state !== "Archived"), [trays]);
  const projectOptions = useMemo(() => appData.listProjects().filter((project) => !project.hidden).map((project) => project.name), []);
  const areaOptions = useMemo(() => appData.listAreas().filter((area) => !area.hidden).map((area) => area.name), []);

  useEffect(() => {
    let isCurrent = true;

    listPersistedTrays()
      .then((persistedTrays) => {
        if (!isCurrent) return;
        setUsesTauriPersistence(true);
        setTrays(persistedTrays);
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

  const resolvedTheme = themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode;

  useEffect(() => {
    if (openPanel === "detail" && !selectedTask) {
      setOpenPanel(null);
    }
  }, [openPanel, selectedTask]);

  function openTask(task: LocalTask) {
    setSelectedTaskId(task.id);
    setOpenPanel("detail");
  }

  function openTray(tray: Tray) {
    setSelectedTrayId(tray.id);
    setActiveTab("trays");
    const firstTask = tray.tasks[0];
    if (firstTask) setSelectedTaskId(firstTask.id);
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
    setSelectedTrayId(nextTray.id);
    setSelectedTaskId(null);
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

  return (
    <div className={cn("min-h-screen bg-[#f7f8fa] text-[#172b4d]", resolvedTheme === "dark" && "theme-dark")}>
      <div className="flex min-h-screen">
        <main className="flex min-w-0 flex-1 flex-col">
          <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} openPanel={setOpenPanel} />
          {activeTab === "trays" ? (
            <TraysView
              trays={activeTrays}
              selectedTray={selectedTray}
              onOpenTray={openTray}
              onCreateTray={createTray}
              onBackToSelector={() => setSelectedTrayId(null)}
              onOpenTask={openTask}
              onAddTask={addTaskToSelectedTray}
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
              setSelectedFavoriteId={setSelectedFavoriteId}
              favorites={appData.listJqlFavorites()}
              results={appData.listJqlResults()}
            />
          )}
        </main>

        {openPanel === "detail" && selectedTask ? (
          <TaskFocusWindow task={selectedTask} onClose={() => setOpenPanel(null)} />
        ) : null}
        {openPanel === "categories" ? (
          <CategoriesPanel
            projects={appData.listProjects()}
            areas={appData.listAreas()}
            onClose={() => setOpenPanel(null)}
          />
        ) : null}
        {openPanel === "settings" ? (
          <SettingsPanel themeMode={themeMode} setThemeMode={setThemeMode} onClose={() => setOpenPanel(null)} />
        ) : null}
      </div>
    </div>
  );
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

  const counts = tasks.reduce(
    (summary, task) => {
      summary[task.syncStatus] += 1;
      return summary;
    },
    { Pending: 0, Failed: 0, Exported: 0, Created: 0 } satisfies Record<LocalTask["syncStatus"], number>
  );

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
