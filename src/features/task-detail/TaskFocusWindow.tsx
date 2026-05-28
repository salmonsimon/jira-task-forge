import { Check, Link2, Pencil, Sparkles, X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, IconButton, IssueTypeBadge, SyncBadge } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { isTaskReadOnly } from "../../lib/domain";
import type {
  AssistedDescriptionDraft,
  AssistedDescriptionProposal,
  AssistedDescriptionProposalStatus,
  AssistedDescriptionSectionId,
  DescriptionProposalLogEntry,
  DescriptionSectionStatus,
  LocalTask,
  NewAssistedDescriptionProposal,
  Priority
} from "../../lib/types";
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
  onListDescriptionProposals,
  onListDescriptionProposalLog,
  onSaveDescription,
  onCreateDescriptionProposal,
  onRefreshTask,
  onTransitionDescriptionProposal,
  onUpdateDescriptionProposalSection,
  onOpenJiraIssue,
  onClose,
  isGeneratingDescription = false,
  proposalModel,
  proposalProvider
}: {
  task: LocalTask;
  childTasks: LocalTask[];
  projects: string[];
  areas: string[];
  readOnly?: boolean;
  onUpdateDetails: (taskId: string, task: Partial<Pick<LocalTask, "project" | "area" | "priority" | "title">>) => void | Promise<void>;
  onAddSubtask: (taskId: string, title: string) => void | Promise<void>;
  onDeleteSubtask: (taskId: string) => void | Promise<void>;
  onGenerateDescription: (taskId: string, additionalContext: string) => Promise<AssistedDescriptionDraft>;
  onListDescriptionProposals?: (taskId: string) => Promise<AssistedDescriptionProposal[]>;
  onListDescriptionProposalLog?: (taskId: string) => Promise<DescriptionProposalLogEntry[]>;
  onSaveDescription: (taskId: string, description: string) => void | Promise<void>;
  onCreateDescriptionProposal?: (proposal: NewAssistedDescriptionProposal) => Promise<AssistedDescriptionProposal>;
  onRefreshTask?: (taskId: string) => Promise<void>;
  onTransitionDescriptionProposal?: (
    proposalId: string,
    status: AssistedDescriptionProposalStatus,
    options?: { reviewerComment?: string | null; applyToTaskDescription?: boolean }
  ) => Promise<AssistedDescriptionProposal | null>;
  onUpdateDescriptionProposalSection?: (
    proposalId: string,
    sectionId: AssistedDescriptionSectionId,
    patch: {
      proposedContent?: string | null;
      status?: DescriptionSectionStatus | null;
      reviewerComment?: string | null;
      applyToTaskDescription?: boolean;
    }
  ) => Promise<AssistedDescriptionProposal | null>;
  onOpenJiraIssue: (url: string) => void | Promise<void>;
  onClose: () => void;
  isGeneratingDescription?: boolean;
  proposalModel?: string | null;
  proposalProvider?: string | null;
}) {
  const readOnly = forceReadOnly || isTaskReadOnly(task);
  const [proposalPanelContainer, setProposalPanelContainer] = useState<HTMLDivElement | null>(null);

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
          <div className="flex-1 overflow-y-auto overscroll-contain px-7 py-7">
            <div className="mb-5 flex items-center gap-2">
              <IssueTypeBadge type={task.issueType} dark />
              <SyncBadge status={task.syncStatus} dark />
              {readOnly ? <span className="rounded bg-[#403f46] px-2 py-1 text-xs text-[#b7bbc4]">Read-only</span> : null}
            </div>
            <FocusedTaskTitle
              task={task}
              readOnly={readOnly}
              onUpdateTitle={(title) => onUpdateDetails(task.id, { title })}
            />

            <AssistedDescriptionSection
              task={task}
              readOnly={readOnly}
              isGeneratingDescription={isGeneratingDescription}
              onGenerateDescription={onGenerateDescription}
              onListProposals={onListDescriptionProposals}
              onListProposalLog={onListDescriptionProposalLog}
              onSaveDescription={onSaveDescription}
              onCreateProposal={onCreateDescriptionProposal}
              onRefreshTask={onRefreshTask}
              onTransitionProposal={onTransitionDescriptionProposal}
              onUpdateProposalSection={onUpdateDescriptionProposalSection}
              proposalPanelContainer={proposalPanelContainer}
              proposalModel={proposalModel}
              proposalProvider={proposalProvider}
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

        <aside className="w-[360px] overflow-y-auto overscroll-contain border-l border-[#454852] bg-[#303238] p-5">
          <TaskDetailsPanel
            task={task}
            projects={projects}
            areas={areas}
            readOnly={readOnly}
            onOpenJiraIssue={onOpenJiraIssue}
            onUpdateDetails={onUpdateDetails}
          />
          <div ref={setProposalPanelContainer} />
        </aside>
      </section>
    </div>
  );
}

function FocusedTaskTitle({
  task,
  readOnly,
  onUpdateTitle
}: {
  task: LocalTask;
  readOnly: boolean;
  onUpdateTitle: (title: string) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const prefix = `[${task.area}]`;

  useEffect(() => {
    if (!isEditing) setDraftTitle(task.title);
  }, [isEditing, task.title]);

  function beginEditing() {
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

  function handleTitleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      acceptEditing();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  if (readOnly) {
    return (
      <h2 className="mb-4 max-w-full text-2xl font-semibold leading-tight text-[#f4f5f7]">
        <span className="text-[#aeb3bd]">{prefix}</span>{" "}
        <span className="break-words" title={task.title}>{task.title}</span>
      </h2>
    );
  }

  if (isEditing) {
    return (
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded bg-[#3a3d43] px-2 py-1 text-sm font-semibold text-[#aeb3bd]">{prefix}</span>
        <input
          autoFocus
          aria-label="Edit local task title"
          className="h-10 min-w-0 flex-1 rounded border border-[#85b8ff] bg-[#22252a] px-3 text-xl font-semibold text-[#f4f5f7] outline-none ring-2 ring-[#1d355c]"
          value={draftTitle}
          onBlur={acceptEditing}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={handleTitleInputKeyDown}
        />
        <button
          aria-label="Save local task title"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#dfe1e6] hover:bg-[#3a3d43]"
          onMouseDown={(event) => event.preventDefault()}
          onClick={acceptEditing}
          type="button"
        >
          <Check size={15} />
        </button>
        <button
          aria-label="Cancel local task title edit"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#dfe1e6] hover:bg-[#3a3d43]"
          onMouseDown={(event) => event.preventDefault()}
          onClick={cancelEditing}
          type="button"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex min-w-0 items-start gap-2">
      <h2 className="min-w-0 flex-1 text-2xl font-semibold leading-tight text-[#f4f5f7]">
        <span className="text-[#aeb3bd]">{prefix}</span>{" "}
        <button
          className="min-w-0 max-w-full break-words rounded text-left hover:text-[#85b8ff] focus:outline-none focus:ring-2 focus:ring-[#85b8ff]"
          onClick={beginEditing}
          title={task.title}
          type="button"
        >
          {task.title}
        </button>
      </h2>
      <button
        aria-label="Edit local task title"
        className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#aeb3bd] hover:bg-[#3a3d43] hover:text-[#f4f5f7]"
        onClick={beginEditing}
        type="button"
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}
