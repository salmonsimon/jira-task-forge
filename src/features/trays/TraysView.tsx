import { Archive, Download, Filter, Loader2, UploadCloud } from "lucide-react";
import { Button, TrayStateBadge } from "../../components/ui";
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
    return <TraySelector trays={trays} onOpenTray={onOpenTray} onCreateTray={onCreateTray} onRenameTray={onRenameTray} />;
  }

  const grouped = groupTasksByProject(selectedTray.tasks);

  return (
    <section className="flex-1 px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <button className="mb-1 text-xs font-medium text-[#0052cc] hover:underline" onClick={onBackToSelector}>
            Back to tray selector
          </button>
          <div className="flex items-center gap-2">
            <h1 className="px-1 text-xl font-semibold">{selectedTray.name}</h1>
            <TrayStateBadge state={selectedTray.state} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Download size={14} />}>
            Export CSV
          </Button>
          <Button variant="secondary" icon={<Archive size={14} />}>
            Archive
          </Button>
          <Button icon={<UploadCloud size={14} />}>Create in Jira</Button>
        </div>
      </div>

      <QuickCapture projects={projects} areas={areas} onAddTask={onAddTask} />

      <div className="mt-4 rounded border border-[#dfe1e6] bg-white">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Preparation tray</h2>
            <p className="text-xs text-[#6b778c]">Grouped by project. Created tasks stay read-only.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b778c]">
            <span className="inline-flex items-center gap-1">
              <Loader2 size={13} /> Sync ready
            </span>
            <Button variant="ghost" icon={<Filter size={14} />}>
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
            />
          ))}
        </div>
      </div>
    </section>
  );
}
