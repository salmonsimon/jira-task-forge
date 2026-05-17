import { Archive, Download, Filter, Loader2, UploadCloud } from "lucide-react";
import { Button, TrayStateBadge } from "../../components/ui";
import type { LocalTask, Tray } from "../../lib/types";
import { groupTasksByProject } from "./groupTasksByProject";
import { ProjectTaskGroup } from "./ProjectTaskGroup";
import { QuickCapture } from "./QuickCapture";
import { TraySelector } from "./TraySelector";

export function TraysView({
  selectedTray,
  onOpenTray,
  onBackToSelector,
  onOpenTask
}: {
  selectedTray: Tray | null;
  onOpenTray: (tray: Tray) => void;
  onBackToSelector: () => void;
  onOpenTask: (task: LocalTask) => void;
}) {
  if (!selectedTray) {
    return <TraySelector onOpenTray={onOpenTray} />;
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
            <input
              className="h-8 w-[340px] rounded border border-transparent bg-transparent px-1 text-xl font-semibold outline-none hover:border-[#dfe1e6] focus:border-[#4c9aff] focus:bg-white"
              defaultValue={selectedTray.name}
            />
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

      <QuickCapture />

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
            <ProjectTaskGroup key={project} project={project} tasks={tasks} onOpenTask={onOpenTask} />
          ))}
        </div>
      </div>
    </section>
  );
}
