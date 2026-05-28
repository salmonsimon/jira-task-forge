import type { Attachment, AttachmentPurpose } from "../types";

export type AttachmentPurposePolicy = {
  purpose: AttachmentPurpose;
  aiEligible: boolean;
  jiraEligible: boolean;
  shortLabel: string;
  detail: string;
  tone: "blue" | "green" | "teal";
};

export const attachmentPurposePolicies: Record<AttachmentPurpose, AttachmentPurposePolicy> = {
  "AI only": {
    purpose: "AI only",
    aiEligible: true,
    jiraEligible: false,
    shortLabel: "AI context",
    detail: "Available for AI context, not uploaded to Jira.",
    tone: "blue"
  },
  "Jira attachment": {
    purpose: "Jira attachment",
    aiEligible: false,
    jiraEligible: true,
    shortLabel: "Jira upload",
    detail: "Prepared for Jira upload, not sent to AI.",
    tone: "green"
  },
  "AI + Jira attachment": {
    purpose: "AI + Jira attachment",
    aiEligible: true,
    jiraEligible: true,
    shortLabel: "AI + Jira",
    detail: "Eligible for explicit AI context and Jira upload.",
    tone: "teal"
  }
};

export function getAttachmentPurposePolicy(purpose: AttachmentPurpose): AttachmentPurposePolicy {
  return attachmentPurposePolicies[purpose];
}

export function countAttachmentsByPurpose(attachments: Attachment[] = []): Record<AttachmentPurpose, number> {
  return {
    "AI only": attachments.filter((attachment) => attachment.purpose === "AI only").length,
    "Jira attachment": attachments.filter((attachment) => attachment.purpose === "Jira attachment").length,
    "AI + Jira attachment": attachments.filter((attachment) => attachment.purpose === "AI + Jira attachment").length
  };
}

export function countAiEligibleAttachments(attachments: Attachment[] = []): number {
  return attachments.filter((attachment) => getAttachmentPurposePolicy(attachment.purpose).aiEligible).length;
}

export function countJiraEligibleAttachments(attachments: Attachment[] = []): number {
  return attachments.filter((attachment) => getAttachmentPurposePolicy(attachment.purpose).jiraEligible).length;
}
