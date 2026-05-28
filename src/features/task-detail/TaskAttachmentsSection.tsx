import { Brain, FileImage, Image, Upload } from "lucide-react";
import type { ReactNode } from "react";
import {
  countAiEligibleAttachments,
  countAttachmentsByPurpose,
  countJiraEligibleAttachments,
  getAttachmentPurposePolicy
} from "../../lib/domain/attachments";
import type { AttachmentPurpose, LocalTask } from "../../lib/types";
import { TaskFocusSection } from "./TaskFocusSection";

export function TaskAttachmentsSection({ task }: { task: LocalTask }) {
  const attachments = task.attachments ?? [];
  const purposeCounts = countAttachmentsByPurpose(attachments);
  const aiEligibleCount = countAiEligibleAttachments(attachments);
  const jiraEligibleCount = countJiraEligibleAttachments(attachments);

  return (
    <TaskFocusSection title="Attachments" count={attachments.length}>
      {attachments.length ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <AttachmentMetric icon={<FileImage size={14} />} label="Files" value={attachments.length} />
            <AttachmentMetric icon={<Brain size={14} />} label="AI context" value={aiEligibleCount} />
            <AttachmentMetric icon={<Upload size={14} />} label="Jira-ready" value={jiraEligibleCount} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {attachments.map((attachment) => {
              const policy = getAttachmentPurposePolicy(attachment.purpose);

              return (
                <div className="overflow-hidden rounded border border-[#454852] bg-[#22252a]" key={attachment.id}>
                  <div className="flex h-24 items-center justify-center bg-[#3a3d43]">
                    <Image size={24} className="text-[#aeb3bd]" />
                  </div>
                  <div className="px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0 font-medium text-[#f4f5f7]" title={attachment.filename}>
                        <span className="block truncate">{attachment.filename}</span>
                      </div>
                      <span className="shrink-0 text-[#8f96a3]">{attachment.size}</span>
                    </div>
                    <div className="mt-2">
                      <AttachmentPurposeBadge purpose={attachment.purpose} />
                    </div>
                    <div className="mt-2 leading-5 text-[#aeb3bd]">{policy.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#aeb3bd]">
            <AttachmentPurposeSummary purpose="AI only" count={purposeCounts["AI only"]} />
            <AttachmentPurposeSummary purpose="Jira attachment" count={purposeCounts["Jira attachment"]} />
            <AttachmentPurposeSummary purpose="AI + Jira attachment" count={purposeCounts["AI + Jira attachment"]} />
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#aeb3bd]">No attachments yet.</div>
      )}
    </TaskFocusSection>
  );
}

function AttachmentMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded border border-[#454852] bg-[#22252a] px-3 py-2">
      <span className="shrink-0 text-[#85b8ff]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[#f4f5f7]">{value}</div>
        <div className="truncate text-[11px] text-[#aeb3bd]">{label}</div>
      </div>
    </div>
  );
}

function AttachmentPurposeBadge({ purpose }: { purpose: AttachmentPurpose }) {
  const policy = getAttachmentPurposePolicy(purpose);

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getPurposeToneClasses(policy.tone)}`}>
      {policy.jiraEligible ? <Upload size={12} className="shrink-0" /> : <Brain size={12} className="shrink-0" />}
      <span className="truncate">{purpose}</span>
    </span>
  );
}

function AttachmentPurposeSummary({ purpose, count }: { purpose: AttachmentPurpose; count: number }) {
  const policy = getAttachmentPurposePolicy(purpose);

  return (
    <span className="rounded border border-[#454852] bg-[#22252a] px-2 py-1">
      {policy.shortLabel}: {count}
    </span>
  );
}

function getPurposeToneClasses(tone: "blue" | "green" | "teal") {
  if (tone === "green") return "bg-[#14532d] text-[#bbf7d0]";
  if (tone === "teal") return "bg-[#134e4a] text-[#99f6e4]";
  return "bg-[#1d4ed8] text-[#dbeafe]";
}
