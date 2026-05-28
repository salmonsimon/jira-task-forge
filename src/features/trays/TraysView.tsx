import { Archive, Check, Download, Loader2, Pencil, RotateCcw, Search, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, IconButton, TrayStateBadge } from "../../components/ui";
import { canExportTrayCsv, deriveTrayStatusTag, filterParentTasksByTraySearch } from "../../lib/domain";
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
  onExportCsv,
  onCreateInJira,
  csvExportMessage,
  isRunningJiraPreflight,
  showArchived,
  onToggleArchived,
  onBackToSelector,
  onOpenTask,
  onAddTask,
  onUpdateTask,
  onDuplicateTask,
  onDeleteTask,
  onOpenJiraIssue,
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
  onExportCsv: (tray: Tray) => void | Promise<void>;
  onCreateInJira: (tray: Tray) => void | Promise<void>;
  csvExportMessage: string | null;
  isRunningJiraPreflight: boolean;
  showArchived: boolean;
  onToggleArchived: () => void;
  onBackToSelector: () => void;
  onOpenTask: (task: LocalTask) => void;
  onAddTask: (task: { project: string; area: string; title: string; priority: Priority }) => void;
  onUpdateTask: (taskId: string, task: Partial<Pick<LocalTask, "area" | "issueType" | "priority" | "title">>) => void | Promise<void>;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  selectedTaskId: string | null;
  projects: string[];
  areas: string[];
}) {
  const [traySearchQuery, setTraySearchQuery] = useState("");

  useEffect(() => {
    setTraySearchQuery("");
  }, [selectedTray?.id]);

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

  const filteredTasks = filterParentTasksByTraySearch(selectedTray.tasks, traySearchQuery);
  const grouped = groupTasksByProject(filteredTasks);
  const hasTraySearch = traySearchQuery.trim().length > 0;
  const isArchived = selectedTray.state === "Archived";
  const createableTaskCount = selectedTray.tasks.filter((task) => task.syncStatus !== "Created").length;
  const canCreateInJira = !isArchived && createableTaskCount > 0 && !isRunningJiraPreflight;
  const canExportCsv = canExportTrayCsv(selectedTray, { includeExported: true });

  return (
    <section className="flex-1 px-5 py-4">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button className="mb-1 text-xs font-medium text-[#0052cc] hover:underline" onClick={onBackToSelector}>
              Back to tray selector
            </button>
            <TrayHeaderName tray={selectedTray} onRenameTray={onRenameTray} />
            {isArchived ? (
              <p className="mt-2 max-w-[560px] text-xs text-[#6b778c]">
                This tray is archived. You can inspect its tasks{canExportCsv ? ", export it," : ""} or restore it before editing.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canExportCsv ? (
              <Button variant="secondary" icon={<Download size={14} />} onClick={() => onExportCsv(selectedTray)}>
                Export CSV
              </Button>
            ) : null}
            {isArchived ? (
              <Button icon={<RotateCcw size={14} />} onClick={() => onRestoreTray(selectedTray.id)}>
                Restore
              </Button>
            ) : (
              <>
                <Button variant="secondary" icon={<Archive size={14} />} onClick={() => onArchiveTray(selectedTray.id)}>
                  Archive
                </Button>
                <Button
                  disabled={!canCreateInJira}
                  icon={isRunningJiraPreflight ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                  onClick={() => onCreateInJira(selectedTray)}
                >
                  {isRunningJiraPreflight
                    ? "Preparing preflight"
                    : selectedTray.tasks.length > 0 && createableTaskCount === 0
                      ? "Created in Jira"
                      : "Create in Jira"}
                </Button>
              </>
            )}
          </div>
        </div>
        {csvExportMessage ? (
          <p className="max-w-[720px] text-xs leading-relaxed text-[#6b778c]" role="status">
            {csvExportMessage}
          </p>
        ) : null}
      </div>

      <QuickCapture disabled={isArchived} projects={projects} areas={areas} onAddTask={onAddTask} />

      <div className="mt-4 rounded border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Preparation tray</h2>
            <p className="text-xs text-[#6b778c]">
              {hasTraySearch
                ? `${filteredTasks.length} of ${selectedTray.tasks.filter((task) => task.issueType !== "Sub-task" && !task.parentTaskId).length} tasks match this tray.`
                : "Grouped by project. Created tasks stay read-only."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[#6b778c]">
            <label className="tray-search-shell flex h-8 min-w-[260px] items-center gap-2 rounded border border-[#c1c7d0] bg-[#f7f8fa] px-2 text-[#42526e] focus-within:border-[#4c9aff] focus-within:ring-2 focus-within:ring-[#deebff]">
              <Search size={14} className="shrink-0" />
              <input
                aria-label="Search current tray"
                className="tray-search-input h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                placeholder="Search current tray"
                value={traySearchQuery}
                onChange={(event) => setTraySearchQuery(event.target.value)}
              />
            </label>
            <span className="inline-flex items-center gap-1">
              <Loader2 size={13} /> {isArchived ? "Archived read-only" : "Sync ready"}
            </span>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {filteredTasks.length ? (
            Object.entries(grouped).map(([project, tasks]) => (
              <ProjectTaskGroup
                key={project}
                project={project}
                tasks={tasks}
                areas={areas}
                selectedTaskId={selectedTaskId}
                onOpenTask={onOpenTask}
                onUpdateTask={onUpdateTask}
                onDuplicateTask={onDuplicateTask}
                onDeleteTask={onDeleteTask}
                onOpenJiraIssue={onOpenJiraIssue}
                readOnly={isArchived}
              />
            ))
          ) : (
            <div className="rounded border border-dashed border-[#c1c7d0] bg-[#f7f8fa] px-4 py-6 text-sm text-[#6b778c]">
              No tasks in this tray match the current search.
            </div>
          )}
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
        <TrayStateBadge state={deriveTrayStatusTag(tray.tasks, tray.state)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="px-1 text-xl font-semibold">{tray.name}</h1>
      <IconButton title="Rename tray" onClick={beginRename}>
        <Pencil size={14} />
      </IconButton>
      <TrayStateBadge state={deriveTrayStatusTag(tray.tasks, tray.state)} />
    </div>
  );
}
