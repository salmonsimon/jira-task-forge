import { Archive, FolderKanban, PanelRightOpen, Plus } from "lucide-react";
import { Button, TrayStateBadge } from "../../components/ui";
import type { Tray } from "../../lib/types";

export function TraySelector({
  trays,
  onOpenTray,
  onCreateTray
}: {
  trays: Tray[];
  onOpenTray: (tray: Tray) => void;
  onCreateTray: () => void;
}) {
  return (
    <section className="flex-1 px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trays</h1>
          <p className="text-sm text-[#6b778c]">Open a saved tray or start a focused one.</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={onCreateTray}>
          New tray
        </Button>
      </div>

      <div className="grid gap-3">
        {trays.length === 0 ? (
          <div className="rounded border border-dashed border-[#c1c7d0] bg-white px-4 py-8 text-center">
            <p className="text-sm font-medium text-[#172b4d]">No trays yet</p>
            <p className="mt-1 text-xs text-[#6b778c]">Create a tray to start preparing local Jira tasks.</p>
          </div>
        ) : null}
        {trays.map((tray) => (
          <button
            className="flex items-center justify-between rounded border border-[#dfe1e6] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#4c9aff] hover:bg-[#f4f8ff]"
            key={tray.id}
            onClick={() => onOpenTray(tray)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-[#42526e]" />
                <span className="font-medium">{tray.name}</span>
                <TrayStateBadge state={tray.state} />
              </div>
              <div className="mt-1 text-xs text-[#6b778c]">{tray.summary}</div>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#6b778c]">
              <span>{tray.updatedAt}</span>
              <PanelRightOpen size={16} />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Button variant="secondary" icon={<Archive size={14} />}>
          View archived
        </Button>
      </div>
    </section>
  );
}
