import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "../../components/ui";
import type { JiraConnectionTestResult, PreflightWarning, Tray } from "../../lib/types";
import { cn } from "../../lib/utils";

export type JiraCreatePreflight = {
  tray: Tray;
  credentialResult: JiraConnectionTestResult | null;
  warnings: PreflightWarning[];
  createableTaskCount: number;
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
        className="w-full max-w-[620px] rounded border border-[#3b4454] bg-[#202328] text-[#dfe1e6] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#454852] px-5 py-4">
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

        <div className="space-y-4 px-5 py-4">
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

        <div className="flex justify-end gap-2 border-t border-[#454852] px-5 py-4">
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
      <ul className="space-y-2">
        {warnings.map((warning, index) => (
          <li className="text-sm text-[#dfe1e6]" key={`${warning.code}-${warning.taskId ?? "tray"}-${index}`}>
            {warning.taskId ? (
              <>
                <span className="font-medium text-[#f4f5f7]">{tasksById.get(warning.taskId)?.title || "Untitled task"}:</span>{" "}
              </>
            ) : null}
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
