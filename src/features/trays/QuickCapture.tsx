import { FolderKanban, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, SelectLike } from "../../components/ui";
import type { Priority } from "../../lib/types";

const priorities: Priority[] = ["Highest", "High", "Medium", "Low", "Lowest"];

export function QuickCapture({
  projects,
  areas,
  onAddTask
}: {
  projects: string[];
  areas: string[];
  onAddTask: (task: { project: string; area: string; title: string; priority: Priority }) => void;
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
          <CaptureSelect ariaLabel="Active project" options={projects} value={project} onChange={setProject} width="w-44" />
        </div>
        <span className="text-xs text-[#6b778c]">Project can be changed before adding the next group of tasks.</span>
      </div>
      <div className="grid grid-cols-[160px_1fr_150px_auto] gap-2">
        <CaptureSelect ariaLabel="Area" options={areas} value={area} onChange={setArea} />
        <input
          className="h-9 rounded border border-[#c1c7d0] px-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
          placeholder="Task title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <CaptureSelect ariaLabel="Priority" options={priorities} value={priority} onChange={(value) => setPriority(value as Priority)} />
        <Button icon={<Plus size={14} />}>Add task</Button>
      </div>
    </form>
  );
}

function CaptureSelect({
  ariaLabel,
  options,
  value,
  onChange,
  width = "w-full"
}: {
  ariaLabel: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  width?: string;
}) {
  if (options.length === 0) {
    return <SelectLike value={value} width={width} />;
  }

  return (
    <select
      aria-label={ariaLabel}
      className={`${width} h-9 rounded border border-[#c1c7d0] bg-white px-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff] [&_option]:bg-white [&_option]:text-[#172b4d] dark:border-[#5c606a] dark:bg-[#303238] dark:text-[#f4f5f7] dark:focus:border-[#85b8ff] dark:focus:ring-[#1d355c] dark:[&_option]:bg-[#303238] dark:[&_option]:text-[#f4f5f7]`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
