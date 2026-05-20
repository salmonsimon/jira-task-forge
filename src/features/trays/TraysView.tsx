import { Archive, Check, Download, Filter, Loader2, Pencil, RotateCcw, UploadCloud, X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, TrayStateBadge } from "../../components/ui";
import type { LocalTask, Priority, Tray } from "../../lib/types";
import { groupTasksByProject } from "./groupTasksByProject";
import { ProjectTaskGroup } from "./ProjectTaskGroup";
import { QuickCapture } from "./QuickCapture";
import { TraySelector } from "./TraySelector";

export function TraysView({
  trays,
  selectedTray,
  onOpenTray,
  onCreateTray,
  onRenameTray,
  onArchiveTray,
  onRestoreTray,
  onDeleteTray,
  showArchived,
  onToggleArchived,
  onBackToSelector,
  onOpenTask,
  onAddTask,
  onDuplicateTask,
  onDeleteTask,
  selectedTaskId,
  projects,
  areas
}: {
  trays: Tray[];
  selectedTray: Tray | null;
  onOpenTray: (tray: Tray) => void;
  onCreateTray: () => void;
  onRenameTray: (trayId: string, name: string) => void;
  onArchiveTray: (trayId: string) => void;
  onRestoreTray: (trayId: string) => void;
  onDeleteTray: (trayId: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  onBackToSelector: () => void;
  onOpenTask: (task: LocalTask) => void;
  onAddTask: (task: { project: string; area: string; title: string; priority: Priority }) => void;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  selectedTaskId: string | null;
  projects: string[];
  areas: string[];
}) {
  if (!selectedTray) {
    return (
      <TraySelector
        trays={trays}
        onOpenTray={onOpenTray}
        onCreateTray={onCreateTray}
        onRenameTray={onRenameTray}
        onArchiveTray={onArchiveTray}
        onRestoreTray={onRestoreTray}
        onDeleteTray={onDeleteTray}
        showArchived={showArchived}
        onToggleArchived={onToggleArchived}
      />
    );
  }

  const grouped = groupTasksByProject(selectedTray.tasks);
  const isArchived = selectedTray.state === "Archived";

  return (
    <section className="flex-1 px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <button className="mb-1 text-xs font-medium text-[#0052cc] hover:underline" onClick={onBackToSelector}>
            Back to tray selector
          </button>
          <TrayHeaderName tray={selectedTray} onRenameTray={onRenameTray} />
          {isArchived ? (
            <p className="mt-2 max-w-[560px] text-xs text-[#6b778c]">
              This tray is archived. You can inspect its tasks, export it, or restore it before editing.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={14} />}>
            Export CSV
          </Button>
          {isArchived ? (
            <Button variant="secondary" icon={<RotateCcw size={14} />} onClick={() => onRestoreTray(selectedTray.id)}>
              Restore
            </Button>
          ) : (
            <>
              <Button variant="secondary" icon={<Archive size={14} />} onClick={() => onArchiveTray(selectedTray.id)}>
                Archive
              </Button>
              <Button icon={<UploadCloud size={14} />}>Create in Jira</Button>
            </>
          )}
        </div>
      </div>

      <QuickCapture disabled={isArchived} projects={projects} areas={areas} onAddTask={onAddTask} />

      <div className="mt-4 rounded border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Preparation tray</h2>
            <p className="text-xs text-[#6b778c]">Grouped by project. Created tasks stay read-only.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b778c]">
            <span className="inline-flex items-center gap-1">
              <Loader2 size={13} /> {isArchived ? "Archived read-only" : "Sync ready"}
            </span>
            <Button disabled={isArchived} variant="ghost" icon={<Filter size={14} />}>
              Review order
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {Object.entries(grouped).map(([project, tasks]) => (
            <ProjectTaskGroup
              key={project}
              project={project}
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onOpenTask={onOpenTask}
              onDuplicateTask={onDuplicateTask}
              onDeleteTask={onDeleteTask}
              readOnly={isArchived}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TrayHeaderName({
  tray,
  onRenameTray
}: {
  tray: Tray;
  onRenameTray: (trayId: string, name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(tray.name);

  function beginRename() {
    setDraftName(tray.name);
    setIsEditing(true);
  }

  function cancelRename() {
    setDraftName(tray.name);
    setIsEditing(false);
  }

  function acceptRename() {
    const nextName = draftName.trim();
    if (nextName && nextName !== tray.name) {
      onRenameTray(tray.id, nextName);
    }
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="h-9 w-[340px] rounded border border-[#4c9aff] bg-white px-2 text-xl font-semibold outline-none ring-2 ring-[#deebff]"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") acceptRename();
            if (event.key === "Escape") cancelRename();
          }}
        />
        <IconButton title="Save tray name" onClick={acceptRename}>
          <Check size={16} />
        </IconButton>
        <IconButton title="Cancel tray rename" onClick={cancelRename}>
          <X size={16} />
        </IconButton>
        <TrayStateBadge state={tray.state} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="px-1 text-xl font-semibold">{tray.name}</h1>
      <IconButton title="Rename tray" onClick={beginRename}>
        <Pencil size={14} />
      </IconButton>
      <TrayStateBadge state={tray.state} />
    </div>
  );
}
