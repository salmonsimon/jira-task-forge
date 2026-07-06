import { Bug, Check, ChevronDown, ClipboardList, Copy, Layers3, Link2, PanelRightOpen, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AreaBadge, DescriptionBadge, IconButton, IssueTypeBadge, PriorityBadge, SyncBadge, useListboxDropdown } from "../../components/ui";
import { canDeleteTask, canDuplicateTask } from "../../lib/domain";
import type { IssueType, LocalTask, Priority } from "../../lib/types";
import { cn } from "../../lib/utils";

const priorities: Priority[] = ["Highest", "High", "Medium", "Low", "Lowest"];
const issueTypes: IssueType[] = ["Story", "Bug", "Sub-task"];

export function ProjectTaskGroup({
  project,
  tasks,
  areas,
  selectedTaskId,
  onOpenTask,
  onUpdateTask,
  onDuplicateTask,
  onDeleteTask,
  onOpenJiraIssue,
  readOnly = false
}: {
  project: string;
  tasks: LocalTask[];
  areas: string[];
  selectedTaskId: string | null;
  onOpenTask: (task: LocalTask) => void;
  onUpdateTask: (taskId: string, task: Partial<Pick<LocalTask, "area" | "issueType" | "priority" | "title">>) => void | Promise<void>;
  onDuplicateTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded border border-[#dfe1e6] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#dfe1e6] bg-[#f4f5f7] px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#42526e]">
          <Layers3 size={14} />
          {project}
        </div>
        <span className="text-xs text-[#6b778c]">{tasks.length} tasks</span>
      </div>
      <div>
        <div className="bg-white">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-white text-left text-xs font-semibold text-[#6b778c]">
                <th className="w-36 px-3 py-2">Area</th>
                <th className="w-28 px-3 py-2">Type</th>
                <th className="px-3 py-2">Title</th>
                <th className="w-28 px-3 py-2">Priority</th>
                <th className="w-28 px-3 py-2">Desc</th>
                <th className="w-28 px-3 py-2">Sync</th>
                <th className="w-24 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isEditable = !readOnly && task.syncStatus !== "Created";

                return (
                  <tr
                    className={cn(
                      "group cursor-pointer border-t border-[#ebecf0] bg-white hover:bg-[#f4f8ff]",
                      selectedTaskId === task.id && "task-row-selected"
                    )}
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                  >
                    <td className="min-w-0 overflow-visible px-3 py-2">
                      {isEditable ? (
                        <InlineTaskSelect
                          ariaLabel={`Change area for ${task.title}`}
                          options={areas}
                          variant="area"
                          value={task.area}
                          onChange={(area) => onUpdateTask(task.id, { area })}
                        />
                      ) : (
                        <AreaBadge area={task.area} />
                      )}
                    </td>
                    <td className="min-w-0 overflow-visible px-3 py-2">
                      {isEditable ? (
                        <InlineTaskSelect
                          ariaLabel={`Change issue type for ${task.title}`}
                          options={issueTypes}
                          variant="type"
                          value={task.issueType}
                          onChange={(issueType) => onUpdateTask(task.id, { issueType: issueType as IssueType })}
                        />
                      ) : (
                        <IssueTypeBadge type={task.issueType} />
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-2">
                      <EditableTaskTitle
                        editable={isEditable}
                        task={task}
                        onOpenJiraIssue={onOpenJiraIssue}
                        onUpdateTitle={(title) => onUpdateTask(task.id, { title })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {isEditable ? (
                        <InlineTaskSelect
                          ariaLabel={`Change priority for ${task.title}`}
                          options={priorities}
                          variant="priority"
                          value={task.priority}
                          onChange={(priority) => onUpdateTask(task.id, { priority: priority as Priority })}
                        />
                      ) : (
                        <PriorityBadge priority={task.priority} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <DescriptionBadge status={task.descriptionStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <SyncBadge status={task.syncStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {!readOnly && canDuplicateTask(task) ? (
                          <IconButton
                            title="Duplicate task"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDuplicateTask(task.id);
                            }}
                          >
                            <Copy size={14} />
                          </IconButton>
                        ) : null}
                        {!readOnly && canDeleteTask(task) ? (
                          <IconButton
                            title="Delete local task"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteTask(task.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        ) : null}
                        <IconButton
                          title="Open detail"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenTask(task);
                          }}
                        >
                          <PanelRightOpen size={14} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EditableTaskTitle({
  editable,
  task,
  onOpenJiraIssue,
  onUpdateTitle
}: {
  editable: boolean;
  task: LocalTask;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  onUpdateTitle: (title: string) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  useEffect(() => {
    if (!isEditing) setDraftTitle(task.title);
  }, [isEditing, task.title]);

  function beginEditing(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setDraftTitle(task.title);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(task.title);
    setIsEditing(false);
  }

  function acceptEditing() {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== task.title) {
      void onUpdateTitle(nextTitle);
    }
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        className="h-8 w-full rounded border border-[#4c9aff] bg-white px-2 text-sm font-medium outline-none ring-2 ring-[#deebff]"
        value={draftTitle}
        onBlur={acceptEditing}
        onChange={(event) => setDraftTitle(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") acceptEditing();
          if (event.key === "Escape") cancelEditing();
        }}
      />
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-left font-medium group-hover:text-[#0052cc]" title={task.title}>{task.title}</span>
        {editable ? (
          <button
            aria-label={`Edit title for ${task.title}`}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#6b778c] opacity-0 transition hover:bg-[#ebecf0] hover:text-[#172b4d] group-hover:opacity-100 focus:opacity-100"
            onClick={beginEditing}
            type="button"
          >
            <Pencil size={12} />
          </button>
        ) : null}
      </div>
      {task.jiraKey ? (
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-[#0052cc]">
          <Link2 size={12} className="shrink-0" />
          {task.jiraUrl ? (
            <a
              className="inline-block min-w-0 max-w-full truncate font-medium hover:underline"
              href={task.jiraUrl}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onOpenJiraIssue(task.jiraUrl!);
              }}
            >
              <span className="truncate">{task.jiraKey}</span>
            </a>
          ) : (
            <span className="min-w-0 truncate">{task.jiraKey}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function InlineTaskSelect({
  ariaLabel,
  options,
  variant,
  value,
  onChange
}: {
  ariaLabel: string;
  options: string[];
  variant: "area" | "priority" | "type";
  value: string;
  onChange: (value: string) => void | Promise<void>;
}) {
  const [opensUp, setOpensUp] = useState(false);
  const effectiveOptions = options.includes(value) ? options : [value, ...options];
  const listbox = useListboxDropdown({
    onChange,
    onOpen: updateOpenDirection,
    options: effectiveOptions,
    value
  });

  function updateOpenDirection() {
    const rect = listbox.containerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpensUp(spaceBelow < 240 && rect.top > spaceBelow);
    }
  }

  return (
    <div className={cn("relative inline-block max-w-full align-middle", listbox.isOpen && "z-[300]")} ref={listbox.containerRef} onClick={(event) => event.stopPropagation()}>
      <button
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-6 max-w-full items-center gap-1 rounded px-2 text-left text-xs font-medium leading-none outline-none transition hover:brightness-95 focus:ring-2 focus:ring-[#deebff]",
          getInlineSelectClasses(variant, value)
        )}
        type="button"
        onClick={listbox.toggleMenu}
        {...listbox.buttonProps}
      >
        {variant === "type" ? getIssueTypeIcon(value) : null}
        <span className="truncate">{value}</span>
        <ChevronDown size={11} className="shrink-0 opacity-70" />
      </button>

      {listbox.isOpen ? (
        <div
          className={cn(
            "app-select-menu absolute left-0 z-[400] max-h-56 min-w-[150px] overflow-y-auto overscroll-contain rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl",
            opensUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          )}
          {...listbox.listboxProps}
        >
          {effectiveOptions.map((option) => {
            const isSelected = option === value;
            return (
              <button
                className={`app-select-option flex h-8 w-full items-center justify-between px-3 text-left hover:bg-[#1d355c] ${
                  isSelected ? "bg-[#0c66e4] text-white" : "text-[#dfe1e6]"
                }`}
                key={option}
                type="button"
                {...listbox.getOptionProps(option)}
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

function getInlineSelectClasses(variant: "area" | "priority" | "type", value: string) {
  if (variant === "area") return "bg-[#deebff] text-[#0747a6]";
  if (variant === "type") return "bg-[#f4f5f7] text-[#42526e]";

  const classes: Record<Priority, string> = {
    Lowest: "bg-[#f4f5f7] text-[#6b778c]",
    Low: "bg-[#e3fcef] text-[#006644]",
    Medium: "bg-[#deebff] text-[#0747a6]",
    High: "bg-[#fff0b3] text-[#974f0c]",
    Highest: "bg-[#ffebe6] text-[#bf2600]"
  };

  return classes[value as Priority] ?? "bg-[#f4f5f7] text-[#6b778c]";
}

function getIssueTypeIcon(type: string) {
  if (type === "Bug") return <Bug size={12} />;
  if (type === "Epic") return <Sparkles size={12} />;
  return <ClipboardList size={12} />;
}
