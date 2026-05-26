import { Archive, Check, FolderKanban, PanelRightOpen, Pencil, RotateCcw, Trash2, Plus, X } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { Button, IconButton, TrayStateBadge } from "../../components/ui";
import { deriveTrayStatusTag } from "../../lib/domain";
import type { Tray } from "../../lib/types";

export function TraySelector({
  trays,
  onOpenTray,
  onCreateTray,
  onRenameTray,
  onArchiveTray,
  onRestoreTray,
  onDeleteTray,
  showArchived,
  onToggleArchived
}: {
  trays: Tray[];
  onOpenTray: (tray: Tray) => void;
  onCreateTray: () => void;
  onRenameTray: (trayId: string, name: string) => void;
  onArchiveTray: (trayId: string) => void;
  onRestoreTray: (trayId: string) => void;
  onDeleteTray: (trayId: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
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

  function stopCardClick(event: MouseEvent) {
    event.stopPropagation();
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
            <p className="text-sm font-medium text-[#172b4d]">{showArchived ? "No archived trays" : "No trays yet"}</p>
            <p className="mt-1 text-xs text-[#6b778c]">
              {showArchived ? "Archived trays will appear here." : "Create a tray to start preparing local Jira tasks."}
            </p>
          </div>
        ) : null}
        {trays.map((tray) => (
          <button
            className="flex w-full items-center justify-between rounded border border-[#dfe1e6] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#4c9aff] hover:bg-[#f4f8ff]"
            key={tray.id}
            onClick={() => {
              if (editingTrayId !== tray.id) onOpenTray(tray);
            }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FolderKanban size={16} className="text-[#42526e]" />
                {editingTrayId === tray.id ? (
                  <span className="flex items-center gap-2" onClick={stopCardClick}>
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
                  </span>
                ) : (
                  <>
                    <span className="font-medium">{tray.name}</span>
                    <IconButton
                      title="Rename tray"
                      onClick={(event) => {
                        event.stopPropagation();
                        beginRename(tray);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                  </>
                )}
                <TrayStateBadge state={deriveTrayStatusTag(tray.tasks, tray.state)} />
              </div>
              <div className="mt-1 text-xs text-[#6b778c]">{tray.summary}</div>
            </div>
            <span className="flex items-center gap-2 text-xs text-[#6b778c]">
              <span>{tray.updatedAt}</span>
              {tray.state === "Archived" ? (
                <IconButton
                  title="Restore tray"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRestoreTray(tray.id);
                  }}
                >
                  <RotateCcw size={15} />
                </IconButton>
              ) : (
                <IconButton
                  title="Archive tray"
                  onClick={(event) => {
                    event.stopPropagation();
                    onArchiveTray(tray.id);
                  }}
                >
                  <Archive size={15} />
                </IconButton>
              )}
              <IconButton
                title="Delete tray"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteTray(tray.id);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
              <PanelRightOpen size={16} />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Button variant="secondary" icon={<Archive size={14} />} onClick={onToggleArchived}>
          {showArchived ? "View active" : "View archived"}
        </Button>
      </div>
    </section>
  );
}
