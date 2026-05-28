import { describe, expect, it } from "vitest";
import type { Attachment } from "../types";
import {
  countAiEligibleAttachments,
  countAttachmentsByPurpose,
  countJiraEligibleAttachments,
  getAttachmentPurposePolicy
} from "./attachments";

const attachments: Attachment[] = [
  {
    id: "attachment-ai",
    filename: "reference.png",
    purpose: "AI only",
    size: "220 KB"
  },
  {
    id: "attachment-jira",
    filename: "bug-proof.mp4",
    purpose: "Jira attachment",
    size: "8 MB"
  },
  {
    id: "attachment-both",
    filename: "annotated-screenshot.png",
    purpose: "AI + Jira attachment",
    size: "480 KB"
  }
];

describe("attachment domain helpers", () => {
  it("maps attachment purpose to explicit transmission policy", () => {
    expect(getAttachmentPurposePolicy("AI only")).toMatchObject({
      aiEligible: true,
      jiraEligible: false,
      shortLabel: "AI context"
    });
    expect(getAttachmentPurposePolicy("Jira attachment")).toMatchObject({
      aiEligible: false,
      jiraEligible: true,
      shortLabel: "Jira upload"
    });
    expect(getAttachmentPurposePolicy("AI + Jira attachment")).toMatchObject({
      aiEligible: true,
      jiraEligible: true,
      shortLabel: "AI + Jira"
    });
  });

  it("counts attachment purposes and upload eligibility separately", () => {
    expect(countAttachmentsByPurpose(attachments)).toEqual({
      "AI only": 1,
      "Jira attachment": 1,
      "AI + Jira attachment": 1
    });
    expect(countAiEligibleAttachments(attachments)).toBe(2);
    expect(countJiraEligibleAttachments(attachments)).toBe(2);
  });
});
