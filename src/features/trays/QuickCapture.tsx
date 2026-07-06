import { Check, ChevronDown, FolderKanban, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, SelectLike, useListboxDropdown } from "../../components/ui";
import type { Priority } from "../../lib/types";

const priorities: Priority[] = ["Highest", "High", "Medium", "Low", "Lowest"];

export function QuickCapture({
  projects,
  areas,
  onAddTask,
  disabled = false
}: {
  projects: string[];
  areas: string[];
  onAddTask: (task: { project: string; area: string; title: string; priority: Priority }) => void;
  disabled?: boolean;
}) {
  const [project, setProject] = useState(projects[0] ?? "STT");
  const [area, setArea] = useState(areas[0] ?? "Bug");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");

  function addCurrentTask() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAddTask({ project, area, title: trimmedTitle, priority });
    setTitle("");
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addCurrentTask();
  }

  return (
    <form className="rounded border border-[#dfe1e6] bg-white p-3" onSubmit={submitTask}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FolderKanban size={16} />
          Active project
          <CaptureSelect ariaLabel="Active project" disabled={disabled} options={projects} value={project} onChange={setProject} width="w-44" />
        </div>
        <span className="text-xs text-[#6b778c]">Project can be changed before adding the next group of tasks.</span>
      </div>
      <div className="grid grid-cols-[160px_1fr_150px_auto] gap-2">
        <CaptureSelect ariaLabel="Area" disabled={disabled} options={areas} value={area} onChange={setArea} />
        <input
          className="h-9 rounded border border-[#c1c7d0] px-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled}
          placeholder="Task title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              addCurrentTask();
            }
          }}
        />
        <CaptureSelect ariaLabel="Priority" disabled={disabled} options={priorities} value={priority} onChange={(value) => setPriority(value as Priority)} />
        <Button disabled={disabled} icon={<Plus size={14} />} type="submit">Add task</Button>
      </div>
    </form>
  );
}

function CaptureSelect({
  ariaLabel,
  options,
  value,
  onChange,
  disabled = false,
  width = "w-full"
}: {
  ariaLabel: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  width?: string;
}) {
  const listbox = useListboxDropdown({ disabled, onChange, options, value });

  if (options.length === 0) {
    return <SelectLike value={value} width={width} />;
  }

  return (
    <div className={`relative ${width}`} ref={listbox.containerRef}>
      <button
        aria-label={ariaLabel}
        className="flex h-9 w-full items-center justify-between rounded border border-[#c1c7d0] bg-white px-3 text-left text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#5c606a] dark:bg-[#303238] dark:text-[#f4f5f7] dark:focus:border-[#85b8ff] dark:focus:ring-[#1d355c]"
        disabled={disabled}
        onClick={listbox.toggleMenu}
        type="button"
        {...listbox.buttonProps}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={15} className="shrink-0 text-[#6b778c] dark:text-[#dfe1e6]" />
      </button>

      {listbox.isOpen ? (
        <div
          className="app-select-menu absolute left-0 top-[calc(100%+4px)] z-30 max-h-60 w-full overflow-y-auto overscroll-contain rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl"
          {...listbox.listboxProps}
        >
          {options.map((option) => {
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
