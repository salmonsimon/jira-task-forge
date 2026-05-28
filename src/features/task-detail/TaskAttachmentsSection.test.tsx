import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LocalTask } from "../../lib/types";
import { TaskAttachmentsSection } from "./TaskAttachmentsSection";

const taskWithAttachments: LocalTask = {
  id: "task-attachments",
  project: "STT",
  area: "Bug",
  title: "Review attachment purposes",
  priority: "Medium",
  issueType: "Story",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish",
  attachments: [
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
  ]
};

describe("TaskAttachmentsSection", () => {
  it("shows attachment purpose and separate AI/Jira eligibility counts", () => {
    const html = renderToStaticMarkup(<TaskAttachmentsSection task={taskWithAttachments} />);

    expect(html).toContain("AI only");
    expect(html).toContain("Jira attachment");
    expect(html).toContain("AI + Jira attachment");
    expect(html).toContain("AI context");
    expect(html).toContain("Jira-ready");
    expect(html).toContain("Eligible for explicit AI context and Jira upload.");
  });
});
