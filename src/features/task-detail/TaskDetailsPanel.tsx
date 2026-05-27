import { Check, ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { DescriptionBadge, PriorityBadge, SyncBadge } from "../../components/ui";
import type { LocalTask, Priority } from "../../lib/types";

const priorities: Priority[] = ["Highest", "High", "Medium", "Low", "Lowest"];

export function TaskDetailsPanel({
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
