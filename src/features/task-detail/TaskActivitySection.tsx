import type { LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

export function TaskActivitySection({ task }: { task: LocalTask }) {
  return (
    <TaskFocusSection title="Activity">
      {task.syncLog?.length ? (
        <div className="space-y-2">
          {task.syncLog.map((entry) => (
            <div className="rounded bg-[#22252a] p-2 text-xs" key={entry.id}>
              <div className="font-semibold text-[#f4f5f7]">{entry.timestamp}</div>
              <div>{entry.event}</div>
              <div className="line-clamp-3 text-[#aeb3bd]" title={entry.detail}>{entry.detail}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-[#aeb3bd]">No sync attempts yet.</div>
      )}
    </TaskFocusSection>
  );
}
