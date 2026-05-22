import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "../../components/ui";
import type { JiraConnectionTestResult, PreflightWarning, PreflightWarningCode, Tray } from "../../lib/types";
import { cn } from "../../lib/utils";

export type JiraCreatePreflight = {
  tray: Tray;
  credentialResult: JiraConnectionTestResult | null;
  warnings: PreflightWarning[];
  createableTaskCount: number;
  creationTarget: string;
};

export function JiraPreflightDialog({
  preflight,
  onClose
}: {
  preflight: JiraCreatePreflight;
  onClose: () => void;
}) {
  const blockingWarnings = preflight.warnings.filter((warning) => warning.severity === "blocking");
  const reviewWarnings = preflight.warnings.filter((warning) => warning.severity !== "blocking");
  const canProceedLater = blockingWarnings.length === 0 && preflight.createableTaskCount > 0;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091e42]/60 px-4 backdrop-blur-[1px]" onMouseDown={onClose}>
      <section
        className="flex max-h-[calc(100vh-72px)] w-full max-w-[620px] flex-col overflow-hidden rounded border border-[#3b4454] bg-[#202328] text-[#dfe1e6] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between border-b border-[#454852] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#f4f5f7]">Jira create preflight</h2>
            <p className="mt-1 text-xs text-[#aeb3bd]">
              {preflight.tray.name} · {preflight.createableTaskCount} createable tasks
            </p>
          </div>
          <button className="rounded p-1 text-[#aeb3bd] hover:bg-[#3a3d43] hover:text-[#f4f5f7]" onClick={onClose} type="button">
            <XCircle size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded border border-[#3b4454] bg-[#292c31] px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#f4f5f7]">
              <ShieldCheck size={16} />
              Credential check
            </div>
            <p className="mt-2 text-sm text-[#b7bbc4]">
              {preflight.credentialResult
                ? preflight.credentialResult.message
                : "Using saved Jira connection settings for this preflight."}
            </p>
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

          <div className="rounded border border-[#315a8a] bg-[#102d50] px-3 py-3 text-sm text-[#85b8ff]">
            Jira writes are still disabled in this slice. The next PR will use this preflight result before creating epics,
            parent issues, sub-tasks, and attachments.
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-2 border-t border-[#454852] px-5 py-4">
          <Button variant="darkSecondary" onClick={onClose}>
            Close
          </Button>
          <Button disabled variant={canProceedLater ? "darkPrimary" : "darkSecondary"}>
            Create in Jira later
          </Button>
        </div>
      </section>
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
                  {warning.taskId ? tasksById.get(warning.taskId)?.title || "Untitled task" : warning.message}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
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
    "missing-sandbox-project": "Missing sandbox project",
    "missing-project": "Missing project",
    "missing-area": "Missing area",
    "missing-title": "Missing title",
    "missing-description": "Missing description",
    "missing-epic": "Missing epic mapping",
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
    "missing-sandbox-project": warning.message,
    "missing-project": "These tasks need a Jira project before they can be created.",
    "missing-area": "These tasks need an area before Jira issue type and labels can be derived.",
    "missing-title": "These tasks need a title before they can be created.",
    "missing-description": "These tasks can still be created, but should be reviewed because their description is missing.",
    "missing-epic": "These tasks can be resolved during Jira creation by creating or selecting an epic.",
    "retry-failed-task": "These failed tasks will be retried with their existing local identity.",
    "exported-duplicate-risk": "These tasks were exported to CSV, so confirm they were not already imported into Jira."
  };

  return summaries[code];
}
