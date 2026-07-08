import { Archive, Check, FolderKanban, PanelRightOpen, Pencil, RotateCcw, Trash2, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, TrayStateBadge } from "../../components/ui";
import { CreateTrayDialog, type CreateTrayInput } from "./CreateTrayDialog";
import { deriveTrayStatusTag } from "../../lib/domain";
import type { Tray } from "../../lib/types";

export function TraySelector({
  trays,
  onOpenTray,
  onCreateTray,
  onSuggestTransversalScope,
  onConfigureAiProvider,
  isAiProviderConfigured,
  onRenameTray,
  onArchiveTray,
  onRestoreTray,
  onDeleteTray,
  showArchived,
  onToggleArchived
}: {
  trays: Tray[];
  onOpenTray: (tray: Tray) => void;
  onCreateTray: (input: CreateTrayInput) => void | Promise<void>;
  onSuggestTransversalScope?: (epicScope: string) => Promise<string>;
  onConfigureAiProvider?: () => void;
  isAiProviderConfigured?: boolean;
  onRenameTray: (trayId: string, name: string) => void;
  onArchiveTray: (trayId: string) => void;
  onRestoreTray: (trayId: string) => void;
  onDeleteTray: (trayId: string) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
}) {
  const [editingTrayId, setEditingTrayId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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
        <Button icon={<Plus size={14} />} onClick={() => setIsCreateDialogOpen(true)}>
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
          <div
            className="flex w-full items-center justify-between rounded border border-[#dfe1e6] bg-white text-left shadow-sm transition hover:border-[#4c9aff] hover:bg-[#f4f8ff] focus-within:border-[#4c9aff] focus-within:ring-2 focus-within:ring-[#deebff]"
            key={tray.id}
          >
            {editingTrayId === tray.id ? (
              <div className="min-w-0 flex-1 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FolderKanban size={16} className="text-[#42526e]" />
                  <span className="flex items-center gap-2">
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
                  <TrayStateBadge state={deriveTrayStatusTag(tray.tasks, tray.state)} />
                </div>
                <div className="mt-1 text-xs text-[#6b778c]">{tray.summary}</div>
              </div>
            ) : (
              <button
                aria-label={`Open tray ${tray.name}`}
                className="flex min-w-0 flex-1 items-center justify-between rounded-l px-4 py-3 text-left outline-none"
                onClick={() => onOpenTray(tray)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <FolderKanban size={16} className="shrink-0 text-[#42526e]" />
                    <span className="font-medium">{tray.name}</span>
                    <TrayStateBadge state={deriveTrayStatusTag(tray.tasks, tray.state)} />
                  </span>
                  <span className="mt-1 block text-xs text-[#6b778c]">{tray.summary}</span>
                </span>
                <PanelRightOpen size={16} className="ml-3 shrink-0 text-[#6b778c]" />
              </button>
            )}
            <span className="flex shrink-0 items-center gap-2 px-4 py-3 text-xs text-[#6b778c]">
              <span>{tray.updatedAt}</span>
              {editingTrayId !== tray.id ? (
                <IconButton title="Rename tray" onClick={() => beginRename(tray)}>
                  <Pencil size={14} />
                </IconButton>
              ) : null}
              {tray.state === "Archived" ? (
                <IconButton title="Restore tray" onClick={() => onRestoreTray(tray.id)}>
                  <RotateCcw size={15} />
                </IconButton>
              ) : (
                <IconButton title="Archive tray" onClick={() => onArchiveTray(tray.id)}>
                  <Archive size={15} />
                </IconButton>
              )}
              <IconButton title="Delete tray" onClick={() => onDeleteTray(tray.id)}>
                <Trash2 size={15} />
              </IconButton>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <Button variant="secondary" icon={<Archive size={14} />} onClick={onToggleArchived}>
          {showArchived ? "View active" : "View archived"}
        </Button>
      </div>
      {isCreateDialogOpen ? (
        <CreateTrayDialog
          onClose={() => setIsCreateDialogOpen(false)}
          onCreateTray={onCreateTray}
          onSuggestTransversalScope={onSuggestTransversalScope}
          onConfigureAiProvider={onConfigureAiProvider}
          isAiProviderConfigured={isAiProviderConfigured}
        />
      ) : null}
    </section>
  );
}
