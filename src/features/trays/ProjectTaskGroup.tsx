import { Copy, Layers3, Link2, PanelRightOpen } from "lucide-react";
import { AreaBadge, DescriptionBadge, IconButton, IssueTypeBadge, PriorityBadge, SyncBadge } from "../../components/ui";
import type { LocalTask } from "../../lib/types";

export function ProjectTaskGroup({
  project,
  tasks,
  onOpenTask
}: {
  project: string;
  tasks: LocalTask[];
  onOpenTask: (task: LocalTask) => void;
}) {
  return (
    <div className="overflow-hidden rounded border border-[#dfe1e6] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#dfe1e6] bg-[#f4f5f7] px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#42526e]">
          <Layers3 size={14} />
          {project}
        </div>
        <span className="text-xs text-[#6b778c]">{tasks.length} tasks</span>
      </div>
      <div>
        <div className="overflow-hidden bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white text-left text-xs font-semibold text-[#6b778c]">
                <th className="w-24 px-3 py-2">Area</th>
                <th className="w-20 px-3 py-2">Type</th>
                <th className="px-3 py-2">Title</th>
                <th className="w-28 px-3 py-2">Priority</th>
                <th className="w-28 px-3 py-2">Desc</th>
                <th className="w-28 px-3 py-2">Sync</th>
                <th className="w-24 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  className="cursor-pointer border-t border-[#ebecf0] bg-white hover:bg-[#f4f8ff]"
                  key={task.id}
                  onClick={() => onOpenTask(task)}
                >
                  <td className="px-3 py-2">
                    <AreaBadge area={task.area} />
                  </td>
                  <td className="px-3 py-2">
                    <IssueTypeBadge type={task.issueType} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-left font-medium group-hover:text-[#0052cc]">{task.title}</span>
                    {task.jiraKey ? (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-[#0052cc]">
                        <Link2 size={12} />
                        {task.jiraKey}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-3 py-2">
                    <DescriptionBadge status={task.descriptionStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <SyncBadge status={task.syncStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <IconButton title="Duplicate task" onClick={(event) => event.stopPropagation()}>
                        <Copy size={14} />
                      </IconButton>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
