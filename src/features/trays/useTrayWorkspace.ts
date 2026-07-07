import { useMemo, useRef, useState } from "react";
import {
  archivePersistedTray,
  createPersistedSubtask,
  createPersistedTask,
  createPersistedTray,
  updatePersistedTrayEpicScopes,
  deletePersistedTask,
  deletePersistedTray,
  renamePersistedTray,
  restorePersistedTray,
  updatePersistedTaskDescription,
  updatePersistedTaskDetails,
  updatePersistedTaskIssueRelationships
} from "../../lib/adapters/tauriPersistence";
import {
  buildDraftSubtask,
  canDeleteTask,
  canDuplicateTask,
  dedupeSubtaskTitles,
  deriveIssueTypeFromArea,
  duplicateLocalTask,
  getDefaultSubtaskTitles,
  hasChildTaskTitle,
  insertChildrenAfterExistingChildren,
  removeTaskGraph,
  taskGraphDeleteIds,
  updateTrayTasks
} from "../../lib/domain";
import type { LocalIssueRelationship, LocalTask, Priority, Tray } from "../../lib/types";
import { buildTaskDetailsUpdate, cloneTrays, findTask, findTaskTray, repairTrayWorkspaceSelection } from "./trayWorkspace";

type ReplaceTraysOptions = {
  fallbackSelectedTrayId?: string | null;
  fallbackSelectedTaskId?: string | null;
};

type SelectWorkspaceOptions = {
  selectedTrayId: string | null;
  selectedTaskId: string | null;
};

export function useTrayWorkspace({
  initialTrays,
  usesTauriPersistence
}: {
  initialTrays: Tray[];
  usesTauriPersistence: boolean;
}) {
  const taskIdCounter = useRef(0);
  const lastSelectedTrayId = useRef<string | null>(null);
  const [trays, setTrays] = useState<Tray[]>(() => cloneTrays(initialTrays));
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("ltask-timer");
  const [showArchivedTrays, setShowArchivedTrays] = useState(false);
  const [trayPendingDelete, setTrayPendingDelete] = useState<Tray | null>(null);

  const selectedTray = useMemo(
    () => trays.find((tray) => tray.id === selectedTrayId) ?? null,
    [selectedTrayId, trays]
  );
  const selectedTask = useMemo(() => findTask(trays, selectedTaskId), [selectedTaskId, trays]);
  const selectedTaskTray = useMemo(() => findTaskTray(trays, selectedTaskId), [selectedTaskId, trays]);
  const visibleTrays = useMemo(
    () => trays.filter((tray) => (showArchivedTrays ? tray.state === "Archived" : tray.state !== "Archived")),
    [showArchivedTrays, trays]
  );

  function replaceTrays(nextTrays: Tray[], options: ReplaceTraysOptions = {}) {
    setTrays(nextTrays);
    repairSelection(nextTrays, options);
  }

  function replaceTraysAndSelect(nextTrays: Tray[], selection: SelectWorkspaceOptions) {
    setTrays(nextTrays);
    setSelectedTrayId(selection.selectedTrayId);
    setSelectedTaskId(selection.selectedTaskId);
    lastSelectedTrayId.current = nextTrays.some((tray) => tray.id === lastSelectedTrayId.current)
      ? lastSelectedTrayId.current
      : null;
  }

  function updateTrayTaskList(trayId: string, getTasks: (tray: Tray) => LocalTask[]) {
    setTrays((currentTrays) =>
      currentTrays.map((tray) => (tray.id === trayId ? updateTrayTasks(tray, getTasks(tray)) : tray))
    );
  }

  function openTask(task: LocalTask) {
    setSelectedTaskId(task.id);
  }

  function openTray(tray: Tray) {
    lastSelectedTrayId.current = tray.id;
    setSelectedTrayId(tray.id);
    setSelectedTaskId(tray.tasks[0]?.id ?? null);
  }

  function closeSelectedTray() {
    if (!selectedTrayId) return;
    lastSelectedTrayId.current = selectedTrayId;
    setSelectedTrayId(null);
  }

  function restoreLastSelectedTray(): Tray | null {
    const tray = trays.find((candidate) => candidate.id === lastSelectedTrayId.current) ?? null;
    if (tray) openTray(tray);
    return tray;
  }

  function backToTraySelector() {
    setShowArchivedTrays(false);
    setSelectedTrayId(null);
  }

  async function createTray(input: { name: string; epicScope?: string | null; transversalEpicScope?: string | null }) {
    const trayName = input.name.trim();
    const nextTray = usesTauriPersistence
      ? await createPersistedScopedTray(trayName, input.epicScope ?? null, input.transversalEpicScope ?? null)
      : {
          id: `tray-local-${Date.now().toString(36)}`,
          name: trayName,
          state: "Active" as const,
          epicScope: input.epicScope ?? undefined,
          transversalEpicScope: input.epicScope === "TBD" ? undefined : (input.transversalEpicScope ?? undefined),
          summary: "No tasks",
          updatedAt: "Just now",
          tasks: []
        };

    setTrays((currentTrays) => [nextTray, ...currentTrays]);
    lastSelectedTrayId.current = nextTray.id;
    setSelectedTrayId(nextTray.id);
    setSelectedTaskId(null);
  }

  async function createPersistedScopedTray(name: string, epicScope: string | null, transversalEpicScope: string | null): Promise<Tray> {
    const createdTray = await createPersistedTray(name);
    const scopedTray = await updatePersistedTrayEpicScopes(createdTray.id, epicScope, transversalEpicScope);
    return scopedTray ? { ...scopedTray, tasks: [] } : createdTray;
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

  function requestDeleteTray(trayId: string) {
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

  function cancelDeleteTray() {
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
    const defaultSubtasks = await createSubtasksForParent(nextTask, getDefaultSubtaskTitles(nextTask));

    setTrays((currentTrays) =>
      currentTrays.map((tray) =>
        tray.id === selectedTrayId ? updateTrayTasks(tray, [...tray.tasks, nextTask, ...defaultSubtasks]) : tray
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
    const deletedTaskIds = taskGraphDeleteIds(tray.tasks, taskId);
    if (usesTauriPersistence) {
      const deleted = await deletePersistedTask(taskId);
      if (!deleted) return;
    }

    if (selectedTaskId && deletedTaskIds.has(selectedTaskId)) {
      const taskIndex = tray.tasks.findIndex((candidate) => candidate.id === taskId);
      const replacementTask =
        tray.tasks.slice(taskIndex + 1).find((candidate) => !deletedTaskIds.has(candidate.id)) ??
        [...tray.tasks.slice(0, taskIndex)].reverse().find((candidate) => !deletedTaskIds.has(candidate.id)) ??
        null;
      setSelectedTaskId(replacementTask?.id ?? null);
    }

    setTrays((currentTrays) =>
      currentTrays.map((candidate) =>
        candidate.id === tray.id ? updateTrayTasks(candidate, removeTaskGraph(candidate.tasks, taskId)) : candidate
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

    const nextTask = buildTaskDetailsUpdate(task, taskInput);
    if (!nextTask) return;

    let persistedTask = usesTauriPersistence ? await updatePersistedTaskDetails(taskId, nextTask) : nextTask;
    if (persistedTask && nextTask.descriptionStatus === "Missing" && task.descriptionStatus !== "Missing") {
      persistedTask = usesTauriPersistence
        ? await updatePersistedTaskDescription(taskId, null, "Missing")
        : nextTask;
    }

    if (!persistedTask) return;
    const defaultSubtaskTitles = getDefaultSubtaskTitles(persistedTask).filter(
      (title) => !hasChildTaskTitle(tray.tasks, taskId, title)
    );
    const createdDefaultSubtasks = defaultSubtaskTitles.length
      ? await createSubtasksForParent(persistedTask, defaultSubtaskTitles)
      : [];

    setTrays((currentTrays) =>
      currentTrays.map((candidate) => {
        if (candidate.id !== tray.id) return candidate;

        const nextTasks = candidate.tasks.map((candidateTask) => (candidateTask.id === taskId ? persistedTask : candidateTask));
        return updateTrayTasks(candidate, insertChildrenAfterExistingChildren(nextTasks, taskId, createdDefaultSubtasks));
      })
    );
  }

  async function updateTaskRelationships(taskId: string, relationships: LocalIssueRelationship[]) {
    const tray = trays.find((candidate) => candidate.tasks.some((task) => task.id === taskId));
    const task = tray?.tasks.find((candidate) => candidate.id === taskId);
    if (!tray || !task || tray.state === "Archived" || task.syncStatus === "Created") return;
    const persistedTask = usesTauriPersistence
      ? await updatePersistedTaskIssueRelationships(taskId, relationships)
      : { ...task, issueRelationships: relationships };

    if (!persistedTask) return;

    setTrays((currentTrays) =>
      currentTrays.map((candidate) => {
        if (candidate.id !== tray.id) return candidate;

        return updateTrayTasks(
          candidate,
          candidate.tasks.map((candidateTask) =>
            candidateTask.id === taskId ? persistedTask : candidateTask
          )
        );
      })
    );
  }

  async function addSubtaskToTask(parentTaskId: string, title: string) {
    const parentTray = trays.find((tray) => tray.tasks.some((task) => task.id === parentTaskId));
    const parentTask = parentTray?.tasks.find((task) => task.id === parentTaskId);
    if (
      !parentTray ||
      !parentTask ||
      parentTray.state === "Archived" ||
      parentTask.syncStatus === "Created" ||
      parentTask.issueType === "Sub-task"
    ) {
      return;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    if (hasChildTaskTitle(parentTray.tasks, parentTaskId, normalizedTitle)) return;

    const createdSubtasks = await createSubtasksForParent(parentTask, [normalizedTitle]);

    setTrays((currentTrays) =>
      currentTrays.map((tray) => {
        if (tray.id !== parentTray.id) return tray;
        return updateTrayTasks(tray, insertChildrenAfterExistingChildren(tray.tasks, parentTask.id, createdSubtasks));
      })
    );
  }

  async function saveTaskDescription(taskId: string, description: string) {
    const tray = trays.find((candidate) => candidate.tasks.some((task) => task.id === taskId));
    const task = tray?.tasks.find((candidate) => candidate.id === taskId);
    const nextDescription = description.trim();
    if (!tray || !task || tray.state === "Archived" || task.syncStatus === "Created") {
      throw new Error("This task cannot be edited.");
    }
    if (!nextDescription) {
      throw new Error("Description cannot be empty.");
    }

    const nextTask = usesTauriPersistence
      ? await updatePersistedTaskDescription(taskId, nextDescription, "Ready")
      : {
          ...task,
          description: nextDescription,
          descriptionStatus: "Ready" as const
        };
    if (!nextTask) {
      throw new Error("Could not save the description.");
    }
    replaceTask(nextTask);
  }

  function replaceTask(nextTask: LocalTask) {
    setTrays((currentTrays) =>
      currentTrays.map((candidate) =>
        candidate.tasks.some((task) => task.id === nextTask.id)
          ? updateTrayTasks(
              candidate,
              candidate.tasks.map((task) => (task.id === nextTask.id ? nextTask : task))
            )
          : candidate
      )
    );
  }

  async function createSubtasksForParent(parentTask: LocalTask, titles: string[]): Promise<LocalTask[]> {
    const normalizedTitles = dedupeSubtaskTitles(titles);
    const createdSubtasks: LocalTask[] = [];

    for (const title of normalizedTitles) {
      const draftSubtask = buildDraftSubtask(parentTask, title, nextTaskId());
      const nextSubtask = usesTauriPersistence ? await createPersistedSubtask(parentTask.id, title) : draftSubtask;
      createdSubtasks.push(nextSubtask);
    }

    return createdSubtasks;
  }

  function nextTaskId() {
    taskIdCounter.current += 1;
    return `ltask-local-${Date.now().toString(36)}-${taskIdCounter.current}`;
  }

  function repairSelection(nextTrays: Tray[], options: ReplaceTraysOptions = {}) {
    setSelectedTrayId((currentTrayId) =>
      repairTrayWorkspaceSelection(
        nextTrays,
        {
          selectedTrayId: currentTrayId,
          selectedTaskId: null,
          lastSelectedTrayId: null
        },
        {
          selectedTrayId: options.fallbackSelectedTrayId
        }
      ).selectedTrayId
    );
    setSelectedTaskId((currentTaskId) =>
      repairTrayWorkspaceSelection(
        nextTrays,
        {
          selectedTrayId: null,
          selectedTaskId: currentTaskId,
          lastSelectedTrayId: null
        },
        {
          selectedTaskId: options.fallbackSelectedTaskId
        }
      ).selectedTaskId
    );
    lastSelectedTrayId.current = repairTrayWorkspaceSelection(nextTrays, {
      selectedTrayId: null,
      selectedTaskId: null,
      lastSelectedTrayId: lastSelectedTrayId.current
    }).lastSelectedTrayId;
  }

  return {
    trays,
    visibleTrays,
    selectedTray,
    selectedTrayId,
    selectedTask,
    selectedTaskId,
    selectedTaskTray,
    showArchivedTrays,
    trayPendingDelete,
    addSubtaskToTask,
    addTaskToSelectedTray,
    archiveTray,
    backToTraySelector,
    cancelDeleteTray,
    closeSelectedTray,
    confirmDeleteTray,
    createTray,
    duplicateTask,
    deleteTask,
    openTask,
    openTray,
    renameTray,
    replaceTask,
    replaceTrays,
    replaceTraysAndSelect,
    requestDeleteTray,
    restoreLastSelectedTray,
    restoreTray,
    saveTaskDescription,
    setSelectedTaskId,
    toggleArchivedTrays: () => setShowArchivedTrays((current) => !current),
    updateTaskDetails,
    updateTaskRelationships,
    updateTrayTaskList
  };
}
