import { Archive, Check, FolderKanban, PanelRightOpen, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, TrayStateBadge } from "../../components/ui";
import type { Tray } from "../../lib/types";

export function TraySelector({
  trays,
  onOpenTray,
  onCreateTray,
  onRenameTray
}: {
  trays: Tray[];
  onOpenTray: (tray: Tray) => void;
  onCreateTray: () => void;
  onRenameTray: (trayId: string, name: string) => void;
}) {
  const [editingTrayId, setEditingTrayId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function beginRename(tray: Tray) {
    setEditingTrayId(tray.id);
    setDraftName(tray.name);
  }

  function cancelRename() {
    setEditingTrayId(null);
    setDraftName("");
  }

  function acceptRename(tray: Tray) {
    const nextName = draftName.trim();
    if (nextName && nextName !== tray.name) {
      onRenameTray(tray.id, nextName);
    }
    cancelRename();
  }

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
          <div
            className="flex items-center justify-between rounded border border-[#dfe1e6] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#4c9aff] hover:bg-[#f4f8ff]"
            key={tray.id}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-[#42526e]" />
                {editingTrayId === tray.id ? (
                  <>
                    <input
                      autoFocus
                      className="h-8 min-w-[260px] rounded border border-[#4c9aff] bg-white px-2 text-sm font-medium outline-none ring-2 ring-[#deebff]"
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") acceptRename(tray);
                        if (event.key === "Escape") cancelRename();
                      }}
                    />
                    <IconButton title="Save tray name" onClick={() => acceptRename(tray)}>
                      <Check size={16} />
                    </IconButton>
                    <IconButton title="Cancel tray rename" onClick={cancelRename}>
                      <X size={16} />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <button className="font-medium hover:underline" onClick={() => onOpenTray(tray)}>
                      {tray.name}
                    </button>
                    <IconButton title="Rename tray" onClick={() => beginRename(tray)}>
                      <Pencil size={14} />
                    </IconButton>
                  </>
                )}
                <TrayStateBadge state={tray.state} />
              </div>
              <div className="mt-1 text-xs text-[#6b778c]">{tray.summary}</div>
            </div>
            <button className="flex items-center gap-3 text-xs text-[#6b778c]" onClick={() => onOpenTray(tray)}>
              <span>{tray.updatedAt}</span>
              <PanelRightOpen size={16} />
            </button>
          </div>
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
