import { Check, ChevronDown, FolderKanban, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, SelectLike } from "../../components/ui";
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

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAddTask({ project, area, title: trimmedTitle, priority });
    setTitle("");
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
        />
        <CaptureSelect ariaLabel="Priority" disabled={disabled} options={priorities} value={priority} onChange={(value) => setPriority(value as Priority)} />
        <Button disabled={disabled} icon={<Plus size={14} />}>Add task</Button>
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

  if (options.length === 0) {
    return <SelectLike value={value} width={width} />;
  }

  function choose(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  function moveSelection(direction: 1 | -1) {
    const nextIndex = (selectedIndex + direction + options.length) % options.length;
    onChange(options[nextIndex]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
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
    <div className={`relative ${width}`} ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="flex h-9 w-full items-center justify-between rounded border border-[#c1c7d0] bg-white px-3 text-left text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#5c606a] dark:bg-[#303238] dark:text-[#f4f5f7] dark:focus:border-[#85b8ff] dark:focus:ring-[#1d355c]"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={15} className="shrink-0 text-[#6b778c] dark:text-[#dfe1e6]" />
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-60 w-full overflow-y-auto rounded border border-[#5c606a] bg-[#2b2d31] py-1 text-sm text-[#f4f5f7] shadow-xl"
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
