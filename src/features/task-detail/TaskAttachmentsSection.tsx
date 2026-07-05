import { Brain, Check, ChevronDown, FileImage, Paperclip, Trash2, Upload } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { Button, FeedbackNote } from "../../components/ui";
import {
  countAiEligibleAttachments,
  countAttachmentsByPurpose,
  countJiraEligibleAttachments,
  getAttachmentPurposePolicy
} from "../../lib/domain/attachments";
import type { AttachmentPurpose, LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

const attachmentPurposeOptions: AttachmentPurpose[] = ["AI + Jira attachment", "Jira attachment", "AI only"];

export function TaskAttachmentsSection({
  task,
  readOnly = false,
  onChooseFiles,
  onUpdatePurpose,
  onDeleteAttachment
}: {
  task: LocalTask;
  readOnly?: boolean;
  onChooseFiles?: (taskId: string) => void | Promise<void>;
  onUpdatePurpose?: (taskId: string, attachmentId: string, purpose: AttachmentPurpose) => void | Promise<void>;
  onDeleteAttachment?: (taskId: string, attachmentId: string) => void | Promise<void>;
}) {
  const attachments = task.attachments ?? [];
  const purposeCounts = countAttachmentsByPurpose(attachments);
  const aiEligibleCount = countAiEligibleAttachments(attachments);
  const jiraEligibleCount = countJiraEligibleAttachments(attachments);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runAttachmentMutation(action: () => void | Promise<void>) {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error || "Attachment action failed."));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <TaskFocusSection
      title="Attachments"
      count={attachments.length}
      actions={
        !readOnly && onChooseFiles ? (
          <Button
            disabled={isBusy}
            icon={<Paperclip size={14} />}
            variant="darkSecondary"
            onClick={() => {
              void runAttachmentMutation(() => onChooseFiles(task.id));
            }}
          >
            Attach files
          </Button>
        ) : null
      }
    >
      <div>
        {attachments.length ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <AttachmentMetric icon={<FileImage size={14} />} label="Files" value={attachments.length} />
              <AttachmentMetric icon={<Brain size={14} />} label="AI context" value={aiEligibleCount} />
              <AttachmentMetric icon={<Upload size={14} />} label="Jira-ready" value={jiraEligibleCount} />
            </div>
            <div className="space-y-2">
              {attachments.map((attachment) => {
                const policy = getAttachmentPurposePolicy(attachment.purpose);

                return (
                  <div
                    className="relative flex min-w-0 items-center gap-3 overflow-visible rounded border border-[#454852] bg-[#22252a] px-3 py-2 text-xs"
                    key={attachment.id}
                  >
                    <AttachmentFileTypeBadge filename={attachment.filename} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-[#f4f5f7]" title={attachment.filename}>
                          {attachment.filename}
                        </span>
                        <span className="shrink-0 text-[#8f96a3]">{attachment.size}</span>
                      </div>
                      <div className="truncate leading-5 text-[#aeb3bd]">{policy.detail}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {readOnly || !onUpdatePurpose ? (
                        <AttachmentPurposeBadge purpose={attachment.purpose} />
                      ) : (
                        <AttachmentPurposeSelect
                          disabled={isBusy}
                          value={attachment.purpose}
                          onChange={(purpose) => {
                            void runAttachmentMutation(() => onUpdatePurpose(task.id, attachment.id, purpose));
                          }}
                        />
                      )}
                      {!readOnly && onDeleteAttachment ? (
                        <button
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#aeb3bd] hover:bg-[#3a3d43] hover:text-[#ffb4a8] disabled:pointer-events-none disabled:opacity-45"
                          disabled={isBusy}
                          onClick={() => {
                            void runAttachmentMutation(() => onDeleteAttachment(task.id, attachment.id));
                          }}
                          title="Remove attachment"
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#aeb3bd]">
              <AttachmentPurposeSummary purpose="AI only" count={purposeCounts["AI only"]} />
              <AttachmentPurposeSummary purpose="Jira attachment" count={purposeCounts["Jira attachment"]} />
              <AttachmentPurposeSummary purpose="AI + Jira attachment" count={purposeCounts["AI + Jira attachment"]} />
            </div>
          </div>
        ) : (
          <div className="rounded border border-dashed border-[#454852] bg-[#22252a]/60 px-3 py-3 text-sm text-[#aeb3bd]">
            <div>No attachments yet.</div>
            {!readOnly && onChooseFiles ? (
              <Button
                className="mt-3"
                disabled={isBusy}
                icon={<Paperclip size={14} />}
                variant="darkSecondary"
                onClick={() => {
                  void runAttachmentMutation(() => onChooseFiles(task.id));
                }}
              >
                Attach files
              </Button>
            ) : null}
          </div>
        )}
        {errorMessage ? (
          <FeedbackNote className="mt-3 text-sm" surface="dark" variant="error">
            {errorMessage}
          </FeedbackNote>
        ) : null}
      </div>
    </TaskFocusSection>
  );
}

function AttachmentFileTypeBadge({ filename }: { filename: string }) {
  const extension = getFileExtension(filename);

  return (
    <span
      className="inline-flex h-8 w-12 shrink-0 items-center justify-center rounded border border-[#454852] bg-[#303238] text-[10px] font-semibold uppercase text-[#85b8ff]"
      title={extension ? `${extension} file` : "File"}
    >
      {extension || <Paperclip size={14} />}
    </span>
  );
}

function AttachmentMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-[#454852] bg-[#22252a] px-3 py-2">
      <span className="shrink-0 text-[#85b8ff]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[#f4f5f7]">{value}</div>
        <div className="truncate text-[11px] text-[#aeb3bd]">{label}</div>
      </div>
    </div>
  );
}

function AttachmentPurposeBadge({ purpose }: { purpose: AttachmentPurpose }) {
  const policy = getAttachmentPurposePolicy(purpose);

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getPurposeToneClasses(policy.tone)}`}>
      {policy.jiraEligible ? <Upload size={12} className="shrink-0" /> : <Brain size={12} className="shrink-0" />}
      <span className="truncate">{purpose}</span>
    </span>
  );
}

function AttachmentPurposeSelect({
  disabled,
  value,
  onChange
}: {
  disabled: boolean;
  value: AttachmentPurpose;
  onChange: (purpose: AttachmentPurpose) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, attachmentPurposeOptions.indexOf(value));

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

  function choose(purpose: AttachmentPurpose) {
    onChange(purpose);
    setIsOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    const nextIndex = (selectedIndex + direction + attachmentPurposeOptions.length) % attachmentPurposeOptions.length;
    onChange(attachmentPurposeOptions[nextIndex]);
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
    <div className="relative min-w-0" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="inline-flex h-7 max-w-full items-center gap-1.5 rounded border border-[#5c606a] bg-[#1f2126] px-2 text-left text-xs font-medium text-[#f4f5f7] outline-none transition hover:bg-[#2b2d31] focus:border-[#85b8ff] disabled:pointer-events-none disabled:opacity-45"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        title={value}
        type="button"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={12} className="shrink-0 opacity-80" />
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 min-w-[180px] overflow-y-auto overscroll-contain rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl"
          role="listbox"
        >
          {attachmentPurposeOptions.map((option) => {
            const isSelected = option === value;
            return (
              <button
                aria-selected={isSelected}
                className={`flex h-8 w-full min-w-0 items-center justify-between gap-2 px-3 text-left hover:bg-[#1d355c] ${
                  isSelected ? "bg-[#0c66e4] text-white" : "text-[#dfe1e6]"
                }`}
                key={option}
                onClick={() => choose(option)}
                role="option"
                title={option}
                type="button"
              >
                <span className="min-w-0 truncate">{option}</span>
                {isSelected ? <Check size={14} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AttachmentPurposeSummary({ purpose, count }: { purpose: AttachmentPurpose; count: number }) {
  const policy = getAttachmentPurposePolicy(purpose);

  return (
    <span className="rounded border border-[#454852] bg-[#22252a] px-2 py-1">
      {policy.shortLabel}: {count}
    </span>
  );
}

function getFileExtension(filename: string) {
  const extension = filename.split(".").pop()?.trim();
  if (!extension || extension === filename) return "";
  return extension.slice(0, 5);
}

function getPurposeToneClasses(tone: "blue" | "green" | "teal") {
  if (tone === "green") return "bg-[#14532d] text-[#bbf7d0]";
  if (tone === "teal") return "bg-[#134e4a] text-[#99f6e4]";
  return "bg-[#1d4ed8] text-[#dbeafe]";
}
