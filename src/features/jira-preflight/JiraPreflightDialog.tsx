import { AlertTriangle, Check, CheckCircle2, ChevronRight, Info, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button, LoadingOrb } from "../../components/ui";
import { appOverlayLayers, useAppOverlay } from "../../lib/app-overlays";
import { formatEpicTarget, groupEpicResolutionWarnings, groupSubtasksByParent, isSubtask } from "../../lib/domain";
import type {
  JiraConnectionTestResult,
  JiraCreateIssuesResult,
  JiraCreateProgress,
  PreflightWarning,
  PreflightWarningCode,
  Tray
} from "../../lib/types";
import { cn } from "../../lib/utils";

type MissingDescriptionMode = "exclude" | "include";

type JiraCreateOptions = {
  allowMissingDescriptions: boolean;
  includeExportedTasks: boolean;
  includeMissingDescriptionTasks: boolean;
};

export type JiraCreatePreflight = {
  tray: Tray;
  credentialResult: JiraConnectionTestResult | null;
  credentialStatus: "idle" | "checking" | "checked";
  warnings: PreflightWarning[];
  createableTaskCount: number;
  creationTarget: string;
};

export function JiraPreflightDialog({
  preflight,
  isCreating,
  isCreatingRecoveryTray,
  createError,
  createResult,
  createProgress,
  onClose,
  onCreate,
  onCreateRecoveryTray
}: {
  preflight: JiraCreatePreflight;
  isCreating: boolean;
  isCreatingRecoveryTray: boolean;
  createError: string | null;
  createResult: JiraCreateIssuesResult | null;
  createProgress: JiraCreateProgress | null;
  onClose: () => void;
  onCreate: (options: JiraCreateOptions) => void;
  onCreateRecoveryTray: () => void;
}) {
  const [missingDescriptionMode, setMissingDescriptionMode] = useState<MissingDescriptionMode>("exclude");
  const [exportedTasksIncluded, setExportedTasksIncluded] = useState(false);
  const blockingWarnings = preflight.warnings.filter((warning) => warning.severity === "blocking");
  const reviewWarnings = preflight.warnings.filter((warning) => warning.severity !== "blocking");
  const exportedTaskIds = new Set(
    preflight.tray.tasks
      .filter((task) => task.syncStatus === "Exported")
      .map((task) => task.id)
  );
  const exportedDuplicateRiskCount = exportedTaskIds.size;
  const includedWarnings = reviewWarnings.filter(
    (warning) => exportedTasksIncluded || !warning.taskId || !exportedTaskIds.has(warning.taskId)
  );
  const missingDescriptionTaskIds = new Set(
    includedWarnings
      .filter((warning) => warning.code === "missing-description" && warning.taskId)
      .map((warning) => warning.taskId!)
  );
  const hasMissingDescriptions = missingDescriptionTaskIds.size > 0;
  const missingDescriptionTasksIncluded = missingDescriptionMode === "include";
  const includedCreateableTaskCount = countIncludedCreateableTasks(
    preflight.tray.tasks,
    exportedTasksIncluded,
    missingDescriptionTasksIncluded
  );
  const isBusy = isCreating || isCreatingRecoveryTray;
  const canCreate =
    blockingWarnings.length === 0 &&
    includedCreateableTaskCount > 0 &&
    preflight.credentialStatus !== "checking" &&
    !createResult &&
    !isBusy;
  const credentialMessage =
    preflight.credentialStatus === "checking"
      ? "Checking Jira credentials..."
      : preflight.credentialResult
        ? preflight.credentialResult.message
        : "Using saved Jira connection settings for this preflight.";
  const overlay = useAppOverlay({
    layer: appOverlayLayers.modal,
    onDismiss: onClose,
    dismissOnEscape: !isBusy,
    dismissOnBackdrop: !isBusy,
    lockScroll: true
  });

  useEffect(() => {
    setMissingDescriptionMode("exclude");
    setExportedTasksIncluded(false);
  }, [preflight.tray.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 px-4 backdrop-blur-[1px]"
      {...overlay.backdropProps}
    >
      <section
        className="relative flex max-h-[calc(100vh-72px)] w-full max-w-[620px] flex-col overflow-hidden rounded border border-[#3b4454] bg-[#202328] text-[#dfe1e6] shadow-2xl"
        {...overlay.surfaceProps}
      >
        {isCreating ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#202328]/95 px-5 backdrop-blur-[2px]">
            <JiraCreateLoading taskCount={includedCreateableTaskCount} progress={createProgress} />
          </div>
        ) : null}

        <div className="shrink-0 flex items-start justify-between border-b border-[#454852] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#f4f5f7]">Jira create preflight</h2>
            <p className="mt-1 text-xs text-[#aeb3bd]">
              {preflight.tray.name} · {preflightTaskCountLabel(
                includedCreateableTaskCount,
                preflight.createableTaskCount,
                exportedDuplicateRiskCount,
                missingDescriptionTaskIds.size
              )}
            </p>
          </div>
          <button
            className="rounded p-1 text-[#aeb3bd] hover:bg-[#3a3d43] hover:text-[#f4f5f7] disabled:pointer-events-none disabled:opacity-45"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            <XCircle size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="rounded border border-[#3b4454] bg-[#292c31] px-3 py-3">
            {preflight.credentialStatus === "checking" ? (
              <div className="flex min-h-[88px] flex-col items-center justify-center gap-3 text-center">
                <LoadingOrb size="sm" />
                <div>
                  <div className="text-sm font-semibold text-[#f4f5f7]">Credential check</div>
                  <p className="mt-1 text-sm text-[#b7bbc4]">{credentialMessage}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
                  <ShieldCheck size={16} />
                  Credential check
                </div>
                <p className="mt-2 text-sm text-[#b7bbc4]">{credentialMessage}</p>
              </>
            )}
          </div>

          <div className="rounded border border-[#3b4454] bg-[#292c31] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#f4f5f7]">Creation target</span>
              <span className="rounded bg-[#102d50] px-2 py-1 text-xs font-medium text-[#85b8ff]">{preflight.creationTarget}</span>
            </div>
          </div>

          <SubtaskCreationSummary
            tray={preflight.tray}
            includeExportedTasks={exportedTasksIncluded}
            includeMissingDescriptionTasks={missingDescriptionTasksIncluded}
          />

          {blockingWarnings.length ? (
            <PreflightWarningGroup
              icon={<AlertTriangle size={16} />}
              title="Blocking"
              tone="danger"
              tray={preflight.tray}
              warnings={blockingWarnings}
            />
          ) : (
            <div className="flex items-center gap-2 rounded border border-[#216e4e] bg-[#143c2b] px-3 py-3 text-sm text-[#7ee2a8]">
              <CheckCircle2 size={16} />
              No blocking issues found.
            </div>
          )}

          {reviewWarnings.length ? (
            <PreflightWarningGroup
              icon={<Info size={16} />}
              title="Needs review"
              tone="warning"
              tray={preflight.tray}
              warnings={reviewWarnings}
            />
          ) : null}

          {exportedDuplicateRiskCount ? (
            <button
              aria-checked={exportedTasksIncluded}
              className={cn(
                "flex w-full min-w-0 items-center gap-3 rounded border border-[#7f5f01] bg-[#2f2606] px-3 py-3 text-left text-sm text-[#dfe1e6] transition hover:bg-[#3a3008] focus:outline-none focus:ring-2 focus:ring-[#579dff] focus:ring-offset-2 focus:ring-offset-[#202328]",
                isBusy && "cursor-not-allowed opacity-60"
              )}
              disabled={isBusy}
              onClick={() => setExportedTasksIncluded((currentValue) => !currentValue)}
              role="checkbox"
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                  exportedTasksIncluded
                    ? "border-[#579dff] bg-[#0c66e4] text-white"
                    : "border-[#9f7f18] bg-[#1f1a06] text-transparent"
                )}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 leading-relaxed">
                Include {exportedDuplicateRiskCount} previously exported {exportedDuplicateRiskCount === 1 ? "task" : "tasks"} in this Jira API run.
              </span>
            </button>
          ) : null}

          {hasMissingDescriptions ? (
            <MissingDescriptionModeSelector
              disabled={isBusy}
              mode={missingDescriptionMode}
              taskCount={missingDescriptionTaskIds.size}
              onChange={setMissingDescriptionMode}
            />
          ) : null}

          {createResult ? (
            <CreateResultSummary
              result={createResult}
              isCreatingRecoveryTray={isCreatingRecoveryTray}
              onCreateRecoveryTray={onCreateRecoveryTray}
            />
          ) : null}
          {createError ? (
            <div className="rounded border border-[#ae2e24] bg-[#4f1d1a] px-3 py-3 text-sm text-[#ffb8ad]">{createError}</div>
          ) : null}
        </div>

        <div className="shrink-0 flex justify-end gap-2 border-t border-[#454852] px-5 py-4">
          <Button disabled={isBusy} variant="darkSecondary" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={!canCreate}
            icon={isCreating ? <Loader2 className="animate-spin" size={16} /> : undefined}
            variant={canCreate || isCreating ? "darkPrimary" : "darkSecondary"}
            onClick={() =>
              onCreate({
                allowMissingDescriptions: missingDescriptionTasksIncluded,
                includeExportedTasks: exportedTasksIncluded,
                includeMissingDescriptionTasks: missingDescriptionTasksIncluded
              })
            }
          >
            {isCreating ? "Creating..." : "Create in Jira"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function JiraCreateLoading({
  taskCount,
  progress
}: {
  taskCount: number;
  progress: JiraCreateProgress | null;
}) {
  const hasDeterminateProgress = Boolean(progress && progress.totalSteps > 1);
  const progressPercent = progress
    ? Math.min(100, Math.max(0, Math.round((progress.completedSteps / Math.max(progress.totalSteps, 1)) * 100)))
    : 0;
  const progressWidth = hasDeterminateProgress ? `${progressPercent}%` : undefined;
  const progressMeta = progress
    ? `${Math.min(progress.completedSteps, progress.totalSteps)} of ${progress.totalSteps}`
    : `${taskCount} ${taskCount === 1 ? "parent issue" : "parent issues"}`;

  return (
    <div className="w-full max-w-[420px] rounded border border-[#315a8a] bg-[#102d50] px-4 py-4 text-[#dfe1e6] shadow-2xl">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#f4f5f7]">{progress?.label ?? "Creating in Jira"}</div>
        <p className="mt-1 truncate text-sm text-[#b7d5ff]">
          {progress?.detail ??
            `Preparing epics and ${taskCount} ${taskCount === 1 ? "parent issue" : "parent issues"}.`}
        </p>
      </div>
      <div className="jira-progress-activity relative mt-4 h-2.5 overflow-hidden rounded-full bg-[#0b2442]">
        <div
          className={cn(
            "absolute inset-y-0 rounded-full transition-all duration-300 ease-out",
            hasDeterminateProgress ? "jira-progress-activity-fill left-0" : "jira-progress-activity-indeterminate"
          )}
          style={hasDeterminateProgress ? { width: progressWidth } : undefined}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#b7d5ff]">
        <span className="truncate">{progress?.step ? progress.step.replace(/-/g, " ") : "working"}</span>
        <span className="shrink-0">{hasDeterminateProgress ? `${progressPercent}% · ${progressMeta}` : progressMeta}</span>
      </div>
    </div>
  );
}

function SubtaskCreationSummary({
  tray,
  includeExportedTasks,
  includeMissingDescriptionTasks
}: {
  tray: Tray;
  includeExportedTasks: boolean;
  includeMissingDescriptionTasks: boolean;
}) {
  const parentTasksById = new Map(tray.tasks.map((task) => [task.id, task]));
  const subtaskGroups = groupSubtasksByParent(
    tray.tasks
    .filter(
      (task) =>
        isSubtask(task) &&
        task.parentTaskId &&
        task.syncStatus !== "Created" &&
        (includeExportedTasks || task.syncStatus !== "Exported") &&
        shouldIncludeSubtaskInPreflightSummary(task, parentTasksById, includeMissingDescriptionTasks, includeExportedTasks)
    ),
    tray.tasks
  );

  if (!subtaskGroups.length) return null;

  const subtaskCount = subtaskGroups.reduce((total, group) => total + group.subtasks.length, 0);

  return (
    <details className="preflight-disclosure rounded border border-[#315a8a] bg-[#102d50]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 focus:outline-none">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight size={14} className="preflight-disclosure-chevron shrink-0 text-[#b7d5ff] transition-transform" />
          <span className="truncate text-sm font-semibold text-[#f4f5f7]">Sub-task creation</span>
        </span>
        <span className="rounded bg-[#0b2442] px-2 py-1 text-xs font-medium text-[#b7d5ff]">
          {subtaskCount} {subtaskCount === 1 ? "sub-task" : "sub-tasks"}
        </span>
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {subtaskGroups.map((group) => {
          const parentTitle = group.parentTask?.title ?? "Missing parent task";

          return (
            <details className="preflight-disclosure rounded border border-[#244d7a] bg-[#0b2442]" key={group.parentTask?.id ?? "missing-parent"}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2 focus:outline-none">
                <span className="flex min-w-0 items-start gap-2">
                  <ChevronRight size={14} className="preflight-disclosure-chevron mt-0.5 shrink-0 text-[#b7d5ff] transition-transform" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#f4f5f7]" title={parentTitle}>{parentTitle}</span>
                    <span className="mt-0.5 block text-xs text-[#b7d5ff]">Review sub-tasks</span>
                  </span>
                </span>
                <span className="shrink-0 rounded bg-[#12365f] px-2 py-0.5 text-xs font-medium text-[#b7d5ff]">
                  {group.subtasks.length} {group.subtasks.length === 1 ? "sub-task" : "sub-tasks"}
                </span>
              </summary>
              <ul className="space-y-1 px-8 pb-2 text-xs text-[#b7d5ff]">
                {group.subtasks.map((subtask) => (
                  <li className="flex min-w-0 gap-2" key={subtask.id}>
                    <span>-</span>
                    <span className="min-w-0 truncate" title={subtask.title}>{subtask.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </details>
  );
}

function preflightTaskCountLabel(
  includedCreateableTaskCount: number,
  createableTaskCount: number,
  exportedDuplicateRiskCount: number,
  missingDescriptionTaskCount: number
): string {
  if (!exportedDuplicateRiskCount && !missingDescriptionTaskCount) {
    return `${createableTaskCount} createable ${createableTaskCount === 1 ? "task" : "tasks"}`;
  }

  return `${includedCreateableTaskCount} selected of ${createableTaskCount} createable ${
    createableTaskCount === 1 ? "task" : "tasks"
  }`;
}

function CreateResultSummary({
  result,
  isCreatingRecoveryTray,
  onCreateRecoveryTray
}: {
  result: JiraCreateIssuesResult;
  isCreatingRecoveryTray: boolean;
  onCreateRecoveryTray: () => void;
}) {
  const tone =
    result.status === "succeeded"
      ? "success"
      : result.status === "partial"
        ? "warning"
        : "danger";

  return (
    <div
      className={cn(
        "rounded border px-3 py-3 text-sm",
        tone === "success" && "border-[#216e4e] bg-[#143c2b] text-[#7ee2a8]",
        tone === "warning" && "border-[#7f5f01] bg-[#3f3102] text-[#f5cd47]",
        tone === "danger" && "border-[#ae2e24] bg-[#4f1d1a] text-[#ffb8ad]"
      )}
    >
      <div className="font-semibold">
        {result.status === "succeeded" ? "Jira creation completed" : result.status === "partial" ? "Jira creation partially completed" : "Jira creation stopped"}
      </div>
      <div className="mt-1 text-[#dfe1e6]">
        {result.createdIssueCount} created · {result.failedIssueCount} failed · {result.skippedIssueCount} skipped
      </div>
      {result.messages.length ? (
        <ul className="mt-2 space-y-1 text-[#dfe1e6]">
          {result.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {result.failedTasks.length ? (
        <div className="mt-3">
          <Button
            disabled={isCreatingRecoveryTray}
            icon={isCreatingRecoveryTray ? <Loader2 className="animate-spin" size={16} /> : undefined}
            variant="darkSecondary"
            onClick={onCreateRecoveryTray}
          >
            Move failed tasks to recovery tray
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MissingDescriptionModeSelector({
  disabled,
  mode,
  taskCount,
  onChange
}: {
  disabled: boolean;
  mode: MissingDescriptionMode;
  taskCount: number;
  onChange: (mode: MissingDescriptionMode) => void;
}) {
  return (
    <div className={cn("rounded border border-[#7f5f01] bg-[#2f2606] px-3 py-3", disabled && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-[#f5cd47]">Missing descriptions</div>
          <p className="mt-1 text-xs leading-relaxed text-[#dfe1e6]">
            Choose whether {taskCount} parent {taskCount === 1 ? "task" : "tasks"} without descriptions are part of this Jira run.
          </p>
        </div>
        <span className="rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#dfe1e6]">
          {taskCount} parent {taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          aria-pressed={mode === "exclude"}
          className={cn(
            "rounded border px-3 py-2 text-left text-sm transition focus:outline-none",
            mode === "exclude"
              ? "border-[#579dff] bg-[#0c2d55] text-[#b7d5ff]"
              : "border-[#7f5f01] bg-[#1f1a06] text-[#dfe1e6] hover:bg-[#3a3008]"
          )}
          disabled={disabled}
          onClick={() => onChange("exclude")}
          type="button"
        >
          Don't include parent tasks with missing descriptions
        </button>
        <button
          aria-pressed={mode === "include"}
          className={cn(
            "rounded border px-3 py-2 text-left text-sm transition focus:outline-none",
            mode === "include"
              ? "border-[#579dff] bg-[#0c2d55] text-[#b7d5ff]"
              : "border-[#7f5f01] bg-[#1f1a06] text-[#dfe1e6] hover:bg-[#3a3008]"
          )}
          disabled={disabled}
          onClick={() => onChange("include")}
          type="button"
        >
          Include parent tasks with missing descriptions
        </button>
      </div>
    </div>
  );
}

function PreflightWarningGroup({
  icon,
  title,
  tone,
  tray,
  warnings
}: {
  icon: ReactNode;
  title: string;
  tone: "danger" | "warning";
  tray: Tray;
  warnings: PreflightWarning[];
}) {
  const tasksById = new Map(tray.tasks.map((task) => [task.id, task]));
  const groupedWarnings = groupWarningsByCode(warnings);

  const warningCount = warnings.length;

  return (
    <details
      className={cn(
        "preflight-disclosure rounded border",
        tone === "danger" && "border-[#ae2e24] bg-[#4f1d1a]",
        tone === "warning" && "border-[#7f5f01] bg-[#3f3102]"
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 focus:outline-none">
        <span className={cn("flex min-w-0 items-center gap-2 text-sm font-semibold", tone === "danger" ? "text-[#ff9c8f]" : "text-[#f5cd47]")}>
          <ChevronRight size={14} className="preflight-disclosure-chevron shrink-0 transition-transform" />
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <span className="shrink-0 rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#dfe1e6]">
          {warningCount} {warningCount === 1 ? "item" : "items"}
        </span>
      </summary>
      <div className="space-y-3 px-3 pb-3">
        {groupedWarnings.map((group) => {
          const epicGroups = group.code === "missing-epic" ? groupEpicResolutionWarnings(group.warnings, tray.tasks) : [];
          const countLabel = group.code === "missing-epic"
            ? `${epicGroups.length} ${epicGroups.length === 1 ? "target" : "targets"}`
            : group.warnings.length;

          return (
            <details className="preflight-disclosure rounded border border-black/20 bg-black/10" key={group.code}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2 focus:outline-none">
                <span className="flex min-w-0 items-start gap-2">
                  <ChevronRight size={14} className="preflight-disclosure-chevron mt-0.5 shrink-0 text-[#dfe1e6] transition-transform" />
                  <span className="min-w-0 truncate text-sm font-semibold text-[#f4f5f7]">{getWarningTitle(group.code)}</span>
                </span>
                <span className="shrink-0 rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#dfe1e6]">
                  {countLabel}
                </span>
              </summary>
              {group.code === "missing-epic" ? (
                <div className="px-3 pb-3">
                  <p className="mb-2 text-xs leading-relaxed text-[#c7cbd3]">{getWarningSummary(group.code, group.warnings[0])}</p>
                  <EpicResolutionWarningLines groups={epicGroups} />
                </div>
              ) : (
                <div className="px-8 pb-3">
                  <p className="mb-2 text-xs leading-relaxed text-[#c7cbd3]">{getWarningSummary(group.code, group.warnings[0])}</p>
                  <ul className="space-y-1.5">
                    {group.warnings.map((warning, index) => (
                      <li className="text-sm text-[#dfe1e6]" key={`${warning.code}-${warning.taskId ?? "tray"}-${index}`}>
                        {warning.taskId ? (
                          <TaskWarningLine code={warning.code} task={tasksById.get(warning.taskId)} />
                        ) : (
                          warning.message
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          );
        })}
      </div>
    </details>
  );
}

function EpicResolutionWarningLines({
  groups
}: {
  groups: ReturnType<typeof groupEpicResolutionWarnings>;
}) {
  return (
    <div className="mt-2 space-y-2">
      {groups.map((group) => (
        <details className="preflight-disclosure rounded border border-black/20 bg-black/10" key={group.target}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-3 py-2 focus:outline-none">
            <span className="flex min-w-0 items-start gap-2">
              <ChevronRight size={14} className="preflight-disclosure-chevron mt-0.5 shrink-0 text-[#dfe1e6] transition-transform" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#f4f5f7]" title={group.target}>{group.target}</span>
                {group.taskTitles.length ? <span className="mt-0.5 block text-xs text-[#dfe1e6]">Review titles</span> : null}
              </span>
            </span>
            <span className="shrink-0 rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#dfe1e6]">
              {group.warnings.length} {group.warnings.length === 1 ? "task" : "tasks"}
            </span>
          </summary>
          {group.taskTitles.length ? (
            <ul className="space-y-1 px-8 pb-2 text-xs text-[#c7cbd3]">
              {group.taskTitles.map((title, index) => (
                <li className="truncate" key={`${group.target}-${title}-${index}`} title={title}>
                  {title}
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ))}
    </div>
  );
}

function shouldIncludeSubtaskInPreflightSummary(
  task: Tray["tasks"][number],
  tasksById: Map<string, Tray["tasks"][number]>,
  includeMissingDescriptionTasks: boolean,
  includeExportedTasks: boolean
): boolean {
  if (!task.parentTaskId) return true;

  const parentTask = tasksById.get(task.parentTaskId);
  if (!parentTask || parentTask.syncStatus === "Created") return true;
  if (!includeExportedTasks && parentTask.syncStatus === "Exported") return false;
  if (!includeMissingDescriptionTasks && parentTask.descriptionStatus === "Missing") return false;

  return true;
}

function countIncludedCreateableTasks(
  tasks: Tray["tasks"],
  includeExportedTasks: boolean,
  includeMissingDescriptionTasks: boolean
): number {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  return tasks.filter((task) => {
    if (task.syncStatus === "Created") return false;
    if (!includeExportedTasks && task.syncStatus === "Exported") return false;
    if (!includeMissingDescriptionTasks && !isSubtask(task) && task.descriptionStatus === "Missing") return false;
    if (!isSubtask(task)) return true;

    return shouldIncludeSubtaskInPreflightSummary(
      task,
      tasksById,
      includeMissingDescriptionTasks,
      includeExportedTasks
    );
  }).length;
}

function TaskWarningLine({ code, task }: { code: PreflightWarningCode; task: Tray["tasks"][number] | undefined }) {
  if (!task) return <>Untitled task</>;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="block min-w-0 max-w-full truncate" title={task.title || "Untitled task"}>{task.title || "Untitled task"}</span>
      {code === "missing-epic" && task.project.trim() && task.area.trim() ? (
        <span className="rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#c7d1db]">
          Epic target: {formatEpicTarget(task.project, task.area)}
        </span>
      ) : null}
    </div>
  );
}

function groupWarningsByCode(warnings: PreflightWarning[]): Array<{ code: PreflightWarningCode; warnings: PreflightWarning[] }> {
  const groups = new Map<PreflightWarningCode, PreflightWarning[]>();
  for (const warning of warnings) {
    groups.set(warning.code, [...(groups.get(warning.code) ?? []), warning]);
  }

  return Array.from(groups, ([code, groupWarnings]) => ({
    code,
    warnings: groupWarnings
  }));
}

function getWarningTitle(code: PreflightWarningCode): string {
  const titles: Record<PreflightWarningCode, string> = {
    "empty-tray": "No createable tasks",
    "missing-credential": "Missing Jira credentials",
    "invalid-credential": "Invalid Jira credentials",
    "missing-creation-project": "Missing Jira project",
    "missing-project": "Missing project",
    "missing-area": "Missing area",
    "missing-title": "Missing title",
    "missing-parent-task": "Missing sub-task parent",
    "missing-description": "Missing description",
    "missing-epic": "Epic resolution",
    "retry-failed-task": "Failed tasks will retry",
    "exported-duplicate-risk": "CSV duplicate risk"
  };

  return titles[code];
}

function getWarningSummary(code: PreflightWarningCode, warning: PreflightWarning): string {
  const summaries: Record<PreflightWarningCode, string> = {
    "empty-tray": warning.message,
    "missing-credential": warning.message,
    "invalid-credential": warning.message,
    "missing-creation-project": warning.message,
    "missing-project": "These tasks need a Jira project before they can be created.",
    "missing-area": "These tasks need an area before Jira issue type and labels can be derived.",
    "missing-title": "These tasks need a title before they can be created.",
    "missing-parent-task": warning.message,
    "missing-description": "These tasks can still be created, but should be reviewed because their description is missing.",
    "missing-epic": "Jira creation will search for each target epic by name and create it only if Jira has no match.",
    "retry-failed-task": "These failed tasks will be retried with their existing local identity.",
    "exported-duplicate-risk": "These tasks were exported to CSV, so confirm they were not already imported into Jira."
  };

  return summaries[code];
}
