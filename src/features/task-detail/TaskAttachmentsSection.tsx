import { Image } from "lucide-react";
import type { LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

export function TaskAttachmentsSection({ task }: { task: LocalTask }) {
  return (
    <TaskFocusSection title="Attachments" count={task.attachments?.length ?? 0}>
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
                  {attachment.purpose}
                  {" \u00b7 "}
                  {attachment.size}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-[#aeb3bd]">No attachments yet.</div>
      )}
    </TaskFocusSection>
  );
}
