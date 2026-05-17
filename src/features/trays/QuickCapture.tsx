import { FolderKanban, Plus } from "lucide-react";
import { Button, SelectLike } from "../../components/ui";

export function QuickCapture() {
  return (
    <div className="rounded border border-[#dfe1e6] bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FolderKanban size={16} />
          Active project
          <SelectLike value="STT" width="w-44" />
        </div>
        <span className="text-xs text-[#6b778c]">Project can be changed before adding the next group of tasks.</span>
      </div>
      <div className="grid grid-cols-[160px_1fr_150px_auto] gap-2">
        <SelectLike value="Bug" />
        <input
          className="h-9 rounded border border-[#c1c7d0] px-3 text-sm outline-none focus:border-[#4c9aff] focus:ring-2 focus:ring-[#deebff]"
          placeholder="Task title"
          defaultValue=""
        />
        <SelectLike value="Medium" />
        <Button icon={<Plus size={14} />}>Add task</Button>
      </div>
    </div>
  );
}
