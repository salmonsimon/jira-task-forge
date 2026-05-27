import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, SyncBadge } from "../../components/ui";
import type { LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

export function TaskSubtasksSection({
  task,
  childTasks,
  readOnly,
  onAddSubtask,
  onDeleteSubtask
}: {
  task: LocalTask;
  childTasks: LocalTask[];
  readOnly: boolean;
  onAddSubtask: (taskId: string, title: string) => void | Promise<void>;
  onDeleteSubtask: (taskId: string) => void | Promise<void>;
}) {
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  useEffect(() => {
    setIsAddingSubtask(false);
    setNewSubtaskTitle("");
  }, [task.id]);

  function startAddingSubtask() {
    setNewSubtaskTitle("");
    setIsAddingSubtask(true);
  }

  function cancelAddingSubtask() {
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  }

  function submitNewSubtask() {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    void onAddSubtask(task.id, title);
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  }

  return (
    <TaskFocusSection title="Sub-tasks" count={childTasks.length}>
      {childTasks.length ? (
        <div className="space-y-2">
          {childTasks.map((subtask) => {
            const canDeleteSubtask = !readOnly && subtask.syncStatus !== "Created";
            return (
              <div
                className="flex min-w-0 items-center gap-2 rounded border border-[#454852] bg-[#22252a] px-3 py-2 text-sm text-[#dfe1e6]"
                key={subtask.id}
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#579dff] bg-[#0c66e4] text-white"
                >
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-[#f4f5f7]">{subtask.title}</span>
                <SyncBadge status={subtask.syncStatus} dark />
                {subtask.jiraKey ? <span className="shrink-0 text-xs text-[#85b8ff]">{subtask.jiraKey}</span> : null}
                <button
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#aeb3bd] hover:bg-[#3a3d43] hover:text-[#ffb4a8] disabled:pointer-events-none disabled:opacity-40"
                  disabled={!canDeleteSubtask}
                  onClick={() => {
                    void onDeleteSubtask(subtask.id);
                  }}
                  title={canDeleteSubtask ? "Delete sub-task" : "Created sub-tasks cannot be deleted"}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-[#aeb3bd]">No sub-tasks yet.</div>
      )}
      {!readOnly && task.issueType !== "Sub-task" ? (
        isAddingSubtask ? (
          <div className="mt-3 flex items-center gap-2 rounded border border-[#454852] bg-[#22252a] px-3 py-2">
            <span
              aria-hidden="true"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#6b7280] text-transparent"
            >
              <Check size={11} strokeWidth={3} />
            </span>
            <input
              autoFocus
              className="h-8 min-w-0 flex-1 rounded border border-[#579dff] bg-[#1f2126] px-2 text-sm text-[#f4f5f7] outline-none"
              onChange={(event) => setNewSubtaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitNewSubtask();
                if (event.key === "Escape") cancelAddingSubtask();
              }}
              placeholder="Sub-task title"
              value={newSubtaskTitle}
            />
            <Button disabled={!newSubtaskTitle.trim()} variant="darkPrimary" onClick={submitNewSubtask}>
              Add
            </Button>
            <Button variant="darkGhost" onClick={cancelAddingSubtask}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <Button variant="darkSecondary" icon={<Plus size={14} />} onClick={startAddingSubtask}>
              Add More
            </Button>
          </div>
        )
      ) : null}
    </TaskFocusSection>
  );
}
