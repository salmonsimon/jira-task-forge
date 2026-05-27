import { Link2, Sparkles, X } from "lucide-react";
import { Button, IconButton, IssueTypeBadge, SyncBadge } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { isTaskReadOnly } from "../../lib/domain";
import type { AssistedDescriptionDraft, LocalTask, Priority } from "../../lib/types";
import { AssistedDescriptionSection, assistedDescriptionEditorSelector } from "./AssistedDescriptionSection";
import { TaskActivitySection } from "./TaskActivitySection";
import { TaskAttachmentsSection } from "./TaskAttachmentsSection";
import { TaskDetailsPanel } from "./TaskDetailsPanel";
import { TaskSubtasksSection } from "./TaskSubtasksSection";

export function TaskFocusWindow({
  task,
  childTasks,
  projects,
  areas,
  readOnly: forceReadOnly = false,
  onUpdateDetails,
  onAddSubtask,
  onDeleteSubtask,
  onGenerateDescription,
  onSaveDescription,
  onOpenJiraIssue,
  onClose,
  isGeneratingDescription = false
}: {
  task: LocalTask;
  childTasks: LocalTask[];
  projects: string[];
  areas: string[];
  readOnly?: boolean;
  onUpdateDetails: (taskId: string, task: { project: string; area: string; priority: Priority }) => void | Promise<void>;
  onAddSubtask: (taskId: string, title: string) => void | Promise<void>;
  onDeleteSubtask: (taskId: string) => void | Promise<void>;
  onGenerateDescription: (taskId: string, additionalContext: string) => Promise<AssistedDescriptionDraft>;
  onSaveDescription: (taskId: string, description: string) => void | Promise<void>;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  onClose: () => void;
  isGeneratingDescription?: boolean;
}) {
  const readOnly = forceReadOnly || isTaskReadOnly(task);

  const overlay = useAppOverlay({
    layer: appOverlayLayers.focusedTask,
    onDismiss: onClose,
    dismissOnEscape: true,
    dismissOnBackdrop: true,
    lockScroll: true,
    shouldDismiss: (reason, event) => {
      if (reason !== "escape") return true;
      return !(event?.target instanceof Element && event.target.closest(assistedDescriptionEditorSelector));
    }
  });

  return (
    <div
      className="fixed inset-0 z-40 bg-[#091e42]/60 px-8 py-8 backdrop-blur-[1px]"
      {...overlay.backdropProps}
    >
      <section
        className="mx-auto flex h-full max-h-[900px] w-full max-w-[1240px] overflow-hidden rounded border border-[#3b4454] bg-[#2b2d31] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#454852] px-7 py-4">
            <div className="flex items-center gap-2 text-sm text-[#aeb3bd]">
              <Sparkles size={15} className="text-[#9f8fef]" />
              <span>{task.epic ?? `[${task.project}] ${task.area}`}</span>
              <span>/</span>
              {task.jiraKey && task.jiraUrl ? (
                <a
                  className="font-medium text-[#85b8ff] hover:underline"
                  href={task.jiraUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void onOpenJiraIssue(task.jiraUrl!);
                  }}
                >
                  {task.jiraKey}
                </a>
              ) : (
                <span>{task.jiraKey ?? task.id}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {task.jiraUrl ? (
                <Button
                  variant="darkGhost"
                  icon={<Link2 size={14} />}
                  onClick={() => {
                    void onOpenJiraIssue(task.jiraUrl!);
                  }}
                >
                  Open in Jira
                </Button>
              ) : null}
              <IconButton title="Close" onClick={onClose}>
                <X size={18} />
              </IconButton>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-7 py-7">
            <div className="mb-5 flex items-center gap-2">
              <IssueTypeBadge type={task.issueType} dark />
              <SyncBadge status={task.syncStatus} dark />
              {readOnly ? <span className="rounded bg-[#403f46] px-2 py-1 text-xs text-[#b7bbc4]">Read-only</span> : null}
            </div>
            <h2 className="mb-4 text-2xl font-semibold leading-tight text-[#f4f5f7]">
              [{task.area}] {task.title}
            </h2>

            <AssistedDescriptionSection
              task={task}
              readOnly={readOnly}
              isGeneratingDescription={isGeneratingDescription}
              onGenerateDescription={onGenerateDescription}
              onSaveDescription={onSaveDescription}
            />
            <TaskAttachmentsSection task={task} />
            <TaskSubtasksSection
              task={task}
              childTasks={childTasks}
              readOnly={readOnly}
              onAddSubtask={onAddSubtask}
              onDeleteSubtask={onDeleteSubtask}
            />
            <TaskActivitySection task={task} />
          </div>
        </div>

        <aside className="w-[360px] overflow-y-auto border-l border-[#454852] bg-[#303238] p-5">
          <TaskDetailsPanel
            task={task}
            projects={projects}
            areas={areas}
            readOnly={readOnly}
            onOpenJiraIssue={onOpenJiraIssue}
            onUpdateDetails={onUpdateDetails}
          />
        </aside>
      </section>
    </div>
  );
}
