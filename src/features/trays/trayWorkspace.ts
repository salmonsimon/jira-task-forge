import type { LocalTask, Tray } from "../../lib/types";

export type TrayWorkspaceSelection = {
  selectedTrayId: string | null;
  selectedTaskId: string | null;
  lastSelectedTrayId: string | null;
};

export type TrayWorkspaceSelectionFallback = Partial<Pick<TrayWorkspaceSelection, "selectedTrayId" | "selectedTaskId">>;

export function cloneTrays(trays: Tray[]): Tray[] {
  return trays.map((tray) => ({
    ...tray,
    tasks: tray.tasks.map((task) => ({
      ...task,
      issueRelationships: task.issueRelationships?.map((relationship) => ({ ...relationship })),
      attachments: task.attachments?.map((attachment) => ({ ...attachment })),
      syncLog: task.syncLog?.map((entry) => ({ ...entry }))
    }))
  }));
}

export function repairTrayWorkspaceSelection(
  trays: Tray[],
  selection: TrayWorkspaceSelection,
  fallback: TrayWorkspaceSelectionFallback = {}
): TrayWorkspaceSelection {
  return {
    selectedTrayId: pickExistingTrayId(trays, selection.selectedTrayId, fallback.selectedTrayId),
    selectedTaskId: pickExistingTaskId(trays, selection.selectedTaskId, fallback.selectedTaskId),
    lastSelectedTrayId: pickExistingTrayId(trays, selection.lastSelectedTrayId)
  };
}

export function findTaskTray(trays: Tray[], taskId: string | null): Tray | null {
  if (!taskId) return null;
  return trays.find((tray) => tray.tasks.some((task) => task.id === taskId)) ?? null;
}

export function findTask(trays: Tray[], taskId: string | null): LocalTask | null {
  return findTaskTray(trays, taskId)?.tasks.find((task) => task.id === taskId) ?? null;
}

function pickExistingTrayId(trays: Tray[], primaryId: string | null | undefined, fallbackId?: string | null): string | null {
  if (primaryId && trays.some((tray) => tray.id === primaryId)) return primaryId;
  if (fallbackId && trays.some((tray) => tray.id === fallbackId)) return fallbackId;
  return null;
}

function pickExistingTaskId(trays: Tray[], primaryId: string | null | undefined, fallbackId?: string | null): string | null {
  if (primaryId && trays.some((tray) => tray.tasks.some((task) => task.id === primaryId))) return primaryId;
  if (fallbackId && trays.some((tray) => tray.tasks.some((task) => task.id === fallbackId))) return fallbackId;
  return null;
}
