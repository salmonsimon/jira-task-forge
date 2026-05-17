import { ChevronDown, CircleAlert, Image, Link2, Settings, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, DescriptionBadge, IconButton, IssueTypeBadge, PriorityBadge, SyncBadge } from "../../components/ui";
import type { LocalTask } from "../../lib/types";

export function TaskFocusWindow({ task, onClose }: { task: LocalTask; onClose: () => void }) {
  const readOnly = task.syncStatus === "Created";

  return (
    <div className="fixed inset-0 z-40 bg-[#091e42]/60 px-8 py-8 backdrop-blur-[1px]" onMouseDown={onClose}>
      <section
        className="mx-auto flex h-full max-h-[900px] w-full max-w-[1240px] overflow-hidden rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#454852] px-7 py-4">
            <div className="flex items-center gap-2 text-sm text-[#aeb3bd]">
              <Sparkles size={15} className="text-[#9f8fef]" />
              <span>{task.epic ?? `[${task.project}] ${task.area}`}</span>
              <span>/</span>
              <span>{task.jiraKey ?? task.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="darkGhost" icon={<Link2 size={14} />}>
                Copy link
              </Button>
              <IconButton title="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-7 py-7">
            <div className="mb-5 flex items-center gap-2">
              <IssueTypeBadge type={task.issueType} dark />
              <SyncBadge status={task.syncStatus} dark />
              {readOnly ? <span className="rounded bg-[#403f46] px-2 py-1 text-xs text-[#b7bbc4]">Read-only</span> : null}
            </div>
            <h2 className="mb-4 text-2xl font-semibold leading-tight text-[#f4f5f7]">
              [{task.area}] {task.title}
            </h2>

            <FocusSection title="Description">
              {task.description ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#dfe1e6]">{task.description}</pre>
              ) : (
                <div className="text-sm text-[#aeb3bd]">
                  No final description yet.
                  {task.notes ? <div className="mt-2 text-[#dfe1e6]">{task.notes}</div> : null}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="darkSecondary" icon={<CircleAlert size={14} />}>
                  Review missing info
                </Button>
                <Button variant="darkSecondary" icon={<Sparkles size={14} />}>
                  Generate description
                </Button>
              </div>
            </FocusSection>

            <FocusSection title="Attachments" count={task.attachments?.length ?? 0}>
              {task.attachments?.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {task.attachments.map((attachment) => (
                    <div className="overflow-hidden rounded border border-[#454852] bg-[#22252a]" key={attachment.id}>
                      <div className="flex h-24 items-center justify-center bg-[#3a3d43]">
                        <Image size={24} className="text-[#aeb3bd]" />
                      </div>
                      <div className="px-3 py-2 text-xs">
                        <div className="font-medium text-[#f4f5f7]">{attachment.filename}</div>
                        <div className="text-[#aeb3bd]">
                          {attachment.purpose} · {attachment.size}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#aeb3bd]">No attachments yet.</div>
              )}
            </FocusSection>

            <FocusSection title="Sub-tasks">
              {task.subtasks?.length ? (
                <div className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <label className="flex items-center gap-2 text-sm text-[#dfe1e6]" key={subtask}>
                      <input defaultChecked type="checkbox" />
                      {subtask}
                    </label>
                  ))}
                  <div className="mt-3 flex gap-2">
                    <Button variant="darkSecondary">Add selected</Button>
                    <Button variant="darkGhost">Discard</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#aeb3bd]">No sub-tasks proposed yet.</div>
              )}
            </FocusSection>

            <FocusSection title="Activity">
              {task.syncLog?.length ? (
                <div className="space-y-2">
                  {task.syncLog.map((entry) => (
                    <div className="rounded bg-[#22252a] p-2 text-xs" key={entry.id}>
                      <div className="font-semibold text-[#f4f5f7]">{entry.timestamp}</div>
                      <div>{entry.event}</div>
                      <div className="text-[#aeb3bd]">{entry.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#aeb3bd]">No sync attempts yet.</div>
              )}
            </FocusSection>
          </div>
        </div>

        <aside className="w-[360px] overflow-y-auto border-l border-[#454852] bg-[#303238] p-5">
          <div className="mb-5 flex items-center gap-2">
            <Button variant="darkPrimary">Ready for Jira</Button>
            <Button variant="darkSecondary" icon={<Sparkles size={14} />}>
              AI
            </Button>
          </div>
          <FocusDetails task={task} />
        </aside>
      </section>
    </div>
  );
}

function FocusSection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-base font-semibold text-[#f4f5f7]">
        <ChevronDown size={16} />
        {title}
        {typeof count === "number" ? (
          <span className="rounded bg-[#454852] px-1.5 py-0.5 text-xs text-[#dfe1e6]">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FocusDetails({ task }: { task: LocalTask }) {
  return (
    <div className="rounded border border-[#454852]">
      <div className="flex items-center justify-between border-b border-[#454852] px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-[#f4f5f7]">
          <ChevronDown size={16} />
          Details
        </div>
        <Settings size={15} className="text-[#aeb3bd]" />
      </div>
      <div className="space-y-4 px-4 py-4 text-sm">
        <FocusDetailRow label="Project" value={task.project} />
        <FocusDetailRow label="Area" value={task.area} />
        <FocusDetailRow label="Priority" value={<PriorityBadge priority={task.priority} dark />} />
        <FocusDetailRow label="Epic" value={task.epic ?? "None"} />
        <FocusDetailRow label="Labels" value={task.area} />
        <FocusDetailRow label="Language" value={`${task.language} · inherited`} />
        <FocusDetailRow label="Description" value={<DescriptionBadge status={task.descriptionStatus} dark />} />
        <FocusDetailRow label="Sync" value={<SyncBadge status={task.syncStatus} dark />} />
        <FocusDetailRow label="Reporter" value="Simon Bahamonde" />
      </div>
    </div>
  );
}

function FocusDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <div className="font-medium text-[#aeb3bd]">{label}</div>
      <div className="min-w-0 text-[#dfe1e6]">{value}</div>
    </div>
  );
}
