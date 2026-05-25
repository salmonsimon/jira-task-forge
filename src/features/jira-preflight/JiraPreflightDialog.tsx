import { AlertTriangle, Check, CheckCircle2, Info, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button, LoadingOrb } from "../../components/ui";
import type {
  JiraConnectionTestResult,
  JiraCreateIssuesResult,
  PreflightWarning,
  PreflightWarningCode,
  Tray
} from "../../lib/types";
import { cn } from "../../lib/utils";

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
  onClose,
  onCreate,
  onCreateRecoveryTray
}: {
  preflight: JiraCreatePreflight;
  isCreating: boolean;
  isCreatingRecoveryTray: boolean;
  createError: string | null;
  createResult: JiraCreateIssuesResult | null;
  onClose: () => void;
  onCreate: (options: { allowMissingDescriptions: boolean }) => void;
  onCreateRecoveryTray: () => void;
}) {
  const [missingDescriptionsConfirmed, setMissingDescriptionsConfirmed] = useState(false);
  const blockingWarnings = preflight.warnings.filter((warning) => warning.severity === "blocking");
  const reviewWarnings = preflight.warnings.filter((warning) => warning.severity !== "blocking");
  const hasMissingDescriptions = reviewWarnings.some((warning) => warning.code === "missing-description");
  const needsMissingDescriptionConfirmation = hasMissingDescriptions && !missingDescriptionsConfirmed;
  const isBusy = isCreating || isCreatingRecoveryTray;
  const canCreate =
    blockingWarnings.length === 0 &&
    preflight.createableTaskCount > 0 &&
    preflight.credentialStatus !== "checking" &&
    !needsMissingDescriptionConfirmation &&
    !isBusy;
  const credentialMessage =
    preflight.credentialStatus === "checking"
      ? "Checking Jira credentials..."
      : preflight.credentialResult
        ? preflight.credentialResult.message
        : "Using saved Jira connection settings for this preflight.";

  useEffect(() => {
    setMissingDescriptionsConfirmed(false);
  }, [preflight.tray.id]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isBusy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 px-4 backdrop-blur-[1px]"
      onMouseDown={() => {
        if (!isBusy) onClose();
      }}
    >
      <section
        className="relative flex max-h-[calc(100vh-72px)] w-full max-w-[620px] flex-col overflow-hidden rounded border border-[#3b4454] bg-[#202328] text-[#dfe1e6] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {isCreating ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#202328]/95 px-5 backdrop-blur-[2px]">
            <JiraCreateLoading taskCount={preflight.createableTaskCount} />
          </div>
        ) : null}

        <div className="shrink-0 flex items-start justify-between border-b border-[#454852] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#f4f5f7]">Jira create preflight</h2>
            <p className="mt-1 text-xs text-[#aeb3bd]">
              {preflight.tray.name} · {preflight.createableTaskCount} createable tasks
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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

          {hasMissingDescriptions ? (
            <button
              aria-checked={missingDescriptionsConfirmed}
              className={cn(
                "flex w-full min-w-0 items-center gap-3 rounded border border-[#7f5f01] bg-[#2f2606] px-3 py-3 text-left text-sm text-[#dfe1e6] transition hover:bg-[#3a3008] focus:outline-none focus:ring-2 focus:ring-[#579dff] focus:ring-offset-2 focus:ring-offset-[#202328]",
                isBusy && "cursor-not-allowed opacity-60"
              )}
              disabled={isBusy}
              onClick={() => setMissingDescriptionsConfirmed((currentValue) => !currentValue)}
              role="checkbox"
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                  missingDescriptionsConfirmed
                    ? "border-[#579dff] bg-[#0c66e4] text-white"
                    : "border-[#9f7f18] bg-[#1f1a06] text-transparent"
                )}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 leading-relaxed">
                I reviewed the missing descriptions and want to create these issues without placeholder descriptions.
              </span>
            </button>
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
            onClick={() => onCreate({ allowMissingDescriptions: missingDescriptionsConfirmed })}
          >
            {isCreating ? "Creating..." : "Create in Jira"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function JiraCreateLoading({ taskCount }: { taskCount: number }) {
  return (
    <div className="w-full max-w-[420px] rounded border border-[#315a8a] bg-[#102d50] px-4 py-4 text-[#dfe1e6] shadow-2xl">
      <div className="flex items-center gap-4">
        <LoadingOrb size="md" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#f4f5f7]">Creating in Jira</div>
          <p className="mt-1 text-sm text-[#b7d5ff]">
            Preparing epics and {taskCount} {taskCount === 1 ? "parent issue" : "parent issues"}.
          </p>
        </div>
      </div>
      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-[#0b2442]">
        <div className="jira-loading-bar absolute inset-y-0 w-1/2 rounded-full bg-[#579dff]" />
      </div>
    </div>
  );
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

  return (
    <div
      className={cn(
        "rounded border px-3 py-3",
        tone === "danger" && "border-[#ae2e24] bg-[#4f1d1a]",
        tone === "warning" && "border-[#7f5f01] bg-[#3f3102]"
      )}
    >
      <div className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", tone === "danger" ? "text-[#ff9c8f]" : "text-[#f5cd47]")}>
        {icon}
        {title}
      </div>
      <div className="space-y-3">
        {groupedWarnings.map((group) => (
          <section className="rounded border border-black/20 bg-black/10 px-3 py-2" key={group.code}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#f4f5f7]">{getWarningTitle(group.code)}</h3>
              <span className="shrink-0 rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#dfe1e6]">
                {group.warnings.length}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#c7cbd3]">{getWarningSummary(group.code, group.warnings[0])}</p>
            <ul className="mt-2 space-y-1.5">
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
          </section>
        ))}
      </div>
    </div>
  );
}

function TaskWarningLine({ code, task }: { code: PreflightWarningCode; task: Tray["tasks"][number] | undefined }) {
  if (!task) return <>Untitled task</>;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{task.title || "Untitled task"}</span>
      {code === "missing-epic" && task.project.trim() && task.area.trim() ? (
        <span className="rounded bg-black/20 px-2 py-0.5 text-xs font-medium text-[#c7d1db]">
          Epic target: {formatEpicTarget(task.project, task.area)}
        </span>
      ) : null}
    </div>
  );
}

function formatEpicTarget(project: string, area: string) {
  return `[${project.trim()}] ${area.trim()}`;
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
    "missing-description": "These tasks can still be created, but should be reviewed because their description is missing.",
    "missing-epic": "Jira creation will search for each target epic by name and create it only if Jira has no match.",
    "retry-failed-task": "These failed tasks will be retried with their existing local identity.",
    "exported-duplicate-risk": "These tasks were exported to CSV, so confirm they were not already imported into Jira."
  };

  return summaries[code];
}
