import { Check, ChevronDown, Image, Link2, Settings, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button, DescriptionBadge, IconButton, IssueTypeBadge, PriorityBadge, SyncBadge } from "../../components/ui";
import { isTaskReadOnly } from "../../lib/domain";
import type { AssistedDescriptionDraft, LocalTask, Priority } from "../../lib/types";

const priorities: Priority[] = ["Highest", "High", "Medium", "Low", "Lowest"];

export function TaskFocusWindow({
  task,
  projects,
  areas,
  readOnly: forceReadOnly = false,
  onUpdateDetails,
  onGenerateDescription,
  onApplyDescriptionProposal,
  onOpenJiraIssue,
  onClose,
  isGeneratingDescription = false
}: {
  task: LocalTask;
  projects: string[];
  areas: string[];
  readOnly?: boolean;
  onUpdateDetails: (taskId: string, task: { project: string; area: string; priority: Priority }) => void | Promise<void>;
  onGenerateDescription: (taskId: string, additionalContext: string) => Promise<AssistedDescriptionDraft>;
  onApplyDescriptionProposal: (taskId: string, description: string) => void | Promise<void>;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  onClose: () => void;
  isGeneratingDescription?: boolean;
}) {
  const readOnly = forceReadOnly || isTaskReadOnly(task);
  const [descriptionContext, setDescriptionContext] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState<string | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [descriptionProposal, setDescriptionProposal] = useState<string | null>(null);
  const [isApplyingDescriptionProposal, setIsApplyingDescriptionProposal] = useState(false);

  useEffect(() => {
    setDescriptionContext("");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
    setDescriptionProposal(null);
    setIsApplyingDescriptionProposal(false);
  }, [task.id]);

  function cancelDescriptionContext() {
    setDescriptionContext("");
    setDescriptionMessage(null);
    setClarificationQuestions([]);
  }

  async function generateDescription() {
    if (readOnly) return;
    setDescriptionMessage("Generating description...");
    setClarificationQuestions([]);

    try {
      const draft = await onGenerateDescription(task.id, descriptionContext);
      if (draft.status === "needs_clarification") {
        setDescriptionMessage("More context is needed before generating a useful description.");
        setClarificationQuestions(draft.clarificationQuestions);
        return;
      }
      if (!draft.description?.trim()) {
        setDescriptionMessage("The AI provider returned an empty description.");
        return;
      }
      setDescriptionProposal(draft.description);
      setDescriptionMessage(null);
      setClarificationQuestions([]);
    } catch (error) {
      setDescriptionMessage(error instanceof Error ? error.message : "Could not generate a description.");
    }
  }

  async function acceptDescriptionProposal() {
    if (!descriptionProposal || isApplyingDescriptionProposal) return;

    setIsApplyingDescriptionProposal(true);
    try {
      await onApplyDescriptionProposal(task.id, descriptionProposal);
      setDescriptionProposal(null);
      setDescriptionContext("");
      setDescriptionMessage(null);
      setClarificationQuestions([]);
    } catch (error) {
      setDescriptionProposal(null);
      setDescriptionMessage(error instanceof Error ? error.message : "Could not apply the proposed description.");
    } finally {
      setIsApplyingDescriptionProposal(false);
    }
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !descriptionProposal) {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [descriptionProposal, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-[#091e42]/60 px-8 py-8 backdrop-blur-[1px]"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mx-auto flex h-full max-h-[900px] w-full max-w-[1240px] overflow-hidden rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#454852] px-7 py-4">
            <div className="flex items-center gap-2 text-sm text-[#aeb3bd]">
              <Sparkles size={15} className="text-[#9f8fef]" />
              <span>{task.epic ?? `[${task.project}] ${task.area}`}</span>
              <span>/</span>
              {task.jiraKey && task.jiraUrl ? (
                <a
                  className="font-medium text-[#85b8ff] hover:underline"
                  href={task.jiraUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onOpenJiraIssue(task.jiraUrl!);
                  }}
                >
                  {task.jiraKey}
                </a>
              ) : (
                <span>{task.jiraKey ?? task.id}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {task.jiraUrl ? (
                <Button
                  variant="darkGhost"
                  icon={<Link2 size={14} />}
                  onClick={() => {
                    void onOpenJiraIssue(task.jiraUrl!);
                  }}
                >
                  Open in Jira
                </Button>
              ) : null}
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
              {!readOnly ? (
                <div className="mt-4 overflow-hidden rounded border border-[#454852] bg-[#25272c]">
                  <div className="flex items-center justify-between border-b border-[#454852] px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
                      <Sparkles size={14} className="text-[#85b8ff]" />
                      AI context
                    </div>
                  </div>
                  <textarea
                    className="min-h-[150px] w-full resize-y border-0 bg-[#1f2126] p-3 text-sm leading-relaxed text-[#dfe1e6] outline-none placeholder:text-[#7f858f] focus:ring-2 focus:ring-inset focus:ring-[#85b8ff]"
                    value={descriptionContext}
                    onChange={(event) => setDescriptionContext(event.target.value)}
                    placeholder="Add behavior, constraints, expected validation, or answers to the questions below."
                  />
                  {descriptionMessage ? (
                    <div className="border-t border-[#454852] px-3 py-2 text-xs leading-relaxed text-[#aeb3bd]">{descriptionMessage}</div>
                  ) : null}
                  {clarificationQuestions.length ? (
                    <div className="border-t border-[#454852] bg-[#22252a] px-3 py-2 text-sm text-[#dfe1e6]">
                      <div className="mb-2 text-xs font-semibold text-[#aeb3bd]">Clarification questions</div>
                      <ul className="space-y-1">
                        {clarificationQuestions.map((question) => (
                          <li className="flex gap-2" key={question}>
                            <span className="text-[#85b8ff]">-</span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2 border-t border-[#454852] px-3 py-3">
                    <Button disabled={isGeneratingDescription} variant="darkSecondary" onClick={cancelDescriptionContext}>
                      Cancel
                    </Button>
                    <Button
                      disabled={isGeneratingDescription}
                      variant="darkPrimary"
                      icon={<Sparkles size={14} />}
                      onClick={() => {
                        void generateDescription();
                      }}
                    >
                      {isGeneratingDescription ? "Generating" : "Generate"}
                    </Button>
                  </div>
                </div>
              ) : null}
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
          <FocusDetails
            task={task}
            projects={projects}
            areas={areas}
            readOnly={readOnly}
            onOpenJiraIssue={onOpenJiraIssue}
            onUpdateDetails={onUpdateDetails}
          />
        </aside>
      </section>
      {descriptionProposal ? (
        <DescriptionProposalDialog
          currentDescription={task.description ?? ""}
          isApplying={isApplyingDescriptionProposal}
          onAccept={() => {
            void acceptDescriptionProposal();
          }}
          onClose={() => setDescriptionProposal(null)}
          proposedDescription={descriptionProposal}
          taskTitle={`[${task.area}] ${task.title}`}
        />
      ) : null}
    </div>
  );
}

function DescriptionProposalDialog({
  currentDescription,
  isApplying,
  onAccept,
  onClose,
  proposedDescription,
  taskTitle
}: {
  currentDescription: string;
  isApplying: boolean;
  onAccept: () => void;
  onClose: () => void;
  proposedDescription: string;
  taskTitle: string;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#091e42]/70 px-4 py-6 backdrop-blur-sm"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="mx-auto flex h-full max-h-[840px] w-full max-w-[980px] flex-col overflow-hidden rounded border border-[#5d6470] bg-[#25272c] text-[#dfe1e6] shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#454852] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
              <Sparkles size={16} className="text-[#85b8ff]" />
              AI proposal review
              <span className="rounded bg-[#1d3b66] px-2 py-1 text-xs font-medium text-[#85b8ff]">Proposal Ready</span>
            </div>
            <p className="mt-1 truncate text-sm text-[#aeb3bd]">{taskTitle}</p>
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="overflow-hidden rounded border border-[#454852] bg-[#25272c]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#454852] px-3 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-medium text-[#f4f5f7]">Description</span>
                <span className="rounded bg-[#1d3b66] px-2 py-1 text-xs font-medium text-[#85b8ff]">Pending</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[#7ee2a8] transition hover:bg-[#183f2e] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isApplying}
                  onClick={onAccept}
                  title="Accept proposal"
                  type="button"
                >
                  <Check size={14} />
                </button>
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-[#ffb4a8] transition hover:bg-[#5d1f1a] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isApplying}
                  onClick={onClose}
                  title="Reject proposal"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="bg-[#1f2126] font-mono text-xs leading-5">
              <div className="md:hidden">
                <InlineDescriptionDiffSection title="Current" tone="removed" lines={trimDiffLines(currentDescription)} />
                <InlineDescriptionDiffSection title="Proposed" tone="added" lines={trimDiffLines(proposedDescription)} />
              </div>
              <div className="hidden md:grid md:grid-cols-2">
                <DescriptionDiffSide title="Current" tone="removed" lines={trimDiffLines(currentDescription)} />
                <DescriptionDiffSide title="Proposed" tone="added" lines={trimDiffLines(proposedDescription)} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#454852] bg-[#22252a] p-4">
          <Button disabled={isApplying} icon={<X size={14} />} onClick={onClose} variant="darkSecondary">
            Reject
          </Button>
          <Button disabled={isApplying} icon={<Check size={14} />} onClick={onAccept} variant="darkPrimary">
            {isApplying ? "Applying" : "Accept proposal"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function InlineDescriptionDiffSection({
  lines,
  title,
  tone
}: {
  lines: string[];
  title: string;
  tone: "added" | "removed";
}) {
  const isRemoved = tone === "removed";

  return (
    <section className={`border-b border-[#454852] last:border-b-0 ${isRemoved ? "bg-[#2b1616]/70 text-[#ffb4a8]" : "bg-[#14251b]/70 text-[#a6e3b8]"}`}>
      <div className={`sticky top-0 z-10 border-b border-[#454852] px-3 py-2 font-sans text-xs font-semibold ${isRemoved ? "bg-[#2b1616] text-[#ffb4a8]" : "bg-[#14251b] text-[#a6e3b8]"}`}>
        {title}
      </div>
      {lines.map((line, index) => (
        <div className="grid grid-cols-[28px_1fr] gap-2 px-3 py-0.5" key={`${tone}-inline-${index}`}>
          <span className="select-none text-[#9aa0aa]">{isRemoved ? "-" : "+"}</span>
          <span className="whitespace-pre-wrap break-words">{line}</span>
        </div>
      ))}
    </section>
  );
}

function DescriptionDiffSide({ lines, title, tone }: { lines: string[]; title: string; tone: "added" | "removed" }) {
  const isRemoved = tone === "removed";

  return (
    <div className={`min-w-0 ${isRemoved ? "md:border-r md:border-[#454852]" : ""}`}>
      <div className={`sticky top-0 z-10 border-b border-[#454852] px-3 py-2 font-sans text-xs font-semibold ${isRemoved ? "bg-[#2b1616] text-[#ffb4a8]" : "bg-[#14251b] text-[#a6e3b8]"}`}>
        {title}
      </div>
      <div className={isRemoved ? "bg-[#2b1616]/70 text-[#ffb4a8]" : "bg-[#14251b]/70 text-[#a6e3b8]"}>
        {lines.map((line, index) => (
          <div className="grid grid-cols-[28px_1fr] gap-2 px-3 py-0.5" key={`${tone}-${index}`}>
            <span className="select-none text-[#9aa0aa]">{isRemoved ? "-" : "+"}</span>
            <span className="whitespace-pre-wrap break-words">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function trimDiffLines(value: string) {
  const lines = (value.trimEnd() || "(empty)").split("\n");
  const maxLines = 40;
  if (lines.length <= maxLines) return lines.map((line) => line || " ");
  return [...lines.slice(0, maxLines).map((line) => line || " "), `... ${lines.length - maxLines} more lines`];
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

function FocusDetails({
  task,
  projects,
  areas,
  readOnly,
  onOpenJiraIssue,
  onUpdateDetails
}: {
  task: LocalTask;
  projects: string[];
  areas: string[];
  readOnly: boolean;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  onUpdateDetails: (taskId: string, task: { project: string; area: string; priority: Priority }) => void | Promise<void>;
}) {
  function updateDetails(nextDetails: Partial<Pick<LocalTask, "project" | "area" | "priority">>) {
    if (readOnly) return;
    onUpdateDetails(task.id, {
      project: nextDetails.project ?? task.project,
      area: nextDetails.area ?? task.area,
      priority: nextDetails.priority ?? task.priority
    });
  }

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
        <FocusDetailRow
          label="Project"
          value={
            readOnly ? (
              <DetailLabel>{task.project}</DetailLabel>
            ) : (
              <DetailSelect
                ariaLabel="Project"
                options={projects}
                value={task.project}
                tone={getMetadataTone(task.project)}
                onChange={(project) => updateDetails({ project })}
              />
            )
          }
        />
        <FocusDetailRow
          label="Area"
          value={
            readOnly ? (
              <DetailLabel tone={getMetadataTone(task.area)}>{task.area}</DetailLabel>
            ) : (
              <DetailSelect
                ariaLabel="Area"
                options={areas}
                value={task.area}
                tone={getMetadataTone(task.area)}
                onChange={(area) => updateDetails({ area })}
              />
            )
          }
        />
        <FocusDetailRow
          label="Priority"
          value={
            readOnly ? (
              <PriorityBadge priority={task.priority} dark />
            ) : (
              <DetailSelect
                ariaLabel="Priority"
                options={priorities}
                value={task.priority}
                tone={task.priority}
                onChange={(priority) => updateDetails({ priority: priority as Priority })}
              />
            )
          }
        />
        <FocusDetailRow label="Epic" muted value={task.epic ?? "Generated from project and area"} />
        {task.jiraKey ? (
          <FocusDetailRow
            label="Jira issue"
            value={
              task.jiraUrl ? (
                <a
                  className="font-medium text-[#85b8ff] hover:underline"
                  href={task.jiraUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    void onOpenJiraIssue(task.jiraUrl!);
                  }}
                >
                  {task.jiraKey}
                </a>
              ) : (
                task.jiraKey
              )
            }
          />
        ) : null}
        <FocusDetailRow label="Labels" muted value={task.area} />
        <FocusDetailRow label="Description" value={<DescriptionBadge status={task.descriptionStatus} dark />} />
        <FocusDetailRow label="Sync" value={<SyncBadge status={task.syncStatus} dark />} />
        <FocusDetailRow label="Reporter" value="Simon Bahamonde" />
      </div>
    </div>
  );
}

function FocusDetailRow({ label, value, muted = false }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <div className="font-medium text-[#aeb3bd]">{label}</div>
      <div className={`min-w-0 ${muted ? "text-[#8f96a3]" : "text-[#dfe1e6]"}`}>{value}</div>
    </div>
  );
}

type DetailTone = "neutral" | "blue" | "green" | "yellow" | "red" | "purple" | "teal" | Priority;

function DetailSelect({
  ariaLabel,
  options,
  value,
  tone = "neutral",
  onChange
}: {
  ariaLabel: string;
  options: string[];
  value: string;
  tone?: DetailTone;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => window.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    const nextIndex = (selectedIndex + direction + options.length) % options.length;
    onChange(options[nextIndex]);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveSelection(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveSelection(-1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((current) => !current);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative inline-block max-w-full" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded px-2 text-left text-xs font-medium outline-none transition hover:brightness-110 focus:ring-2 focus:ring-[#85b8ff] ${getDetailSelectToneClasses(tone)}`}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} className="shrink-0 opacity-80" />
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 min-w-[160px] overflow-y-auto rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl"
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option === value;
            return (
              <button
                aria-selected={isSelected}
                className={`flex h-8 w-full items-center justify-between px-3 text-left hover:bg-[#1d355c] ${
                  isSelected ? "bg-[#0c66e4] text-white" : "text-[#dfe1e6]"
                }`}
                key={option}
                onClick={() => choose(option)}
                role="option"
                type="button"
              >
                <span className="truncate">{option}</span>
                {isSelected ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DetailLabel({ children, tone = "neutral" }: { children: ReactNode; tone?: DetailTone }) {
  return <span className={`inline-flex max-w-full rounded px-2 py-1 text-xs font-medium ${getDetailSelectToneClasses(tone)}`}>{children}</span>;
}

function getDetailSelectToneClasses(tone: DetailTone): string {
  const classes: Record<DetailTone, string> = {
    neutral: "bg-[#454852] text-[#dfe1e6]",
    blue: "bg-[#1d3b66] text-[#85b8ff]",
    green: "bg-[#183f2e] text-[#7ee2a8]",
    yellow: "bg-[#533f04] text-[#f5cd47]",
    red: "bg-[#5d1f1a] text-[#ff9c8f]",
    purple: "bg-[#352c63] text-[#c0b6f2]",
    teal: "bg-[#164b4f] text-[#79e2d2]",
    Lowest: "bg-[#454852] text-[#aeb3bd]",
    Low: "bg-[#183f2e] text-[#7ee2a8]",
    Medium: "bg-[#1d3b66] text-[#85b8ff]",
    High: "bg-[#533f04] text-[#f5cd47]",
    Highest: "bg-[#5d1f1a] text-[#ff9c8f]"
  };

  return classes[tone];
}

function getMetadataTone(value: string): DetailTone {
  const tones: DetailTone[] = ["blue", "green", "yellow", "red", "purple", "teal"];
  const charTotal = value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);

  return tones[charTotal % tones.length];
}
