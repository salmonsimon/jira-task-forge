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

  it("lets purpose menus render outside attachment card bounds", () => {
    const html = renderToStaticMarkup(
      <TaskAttachmentsSection task={taskWithAttachments} onChooseFiles={() => {}} onUpdatePurpose={() => {}} />
    );

    expect(html).toContain("overflow-visible");
    expect(html).not.toContain("overflow-hidden rounded border border-[#454852]");
  });

  it("shows attachment actions only for editable tasks", () => {
    const editableHtml = renderToStaticMarkup(
      <TaskAttachmentsSection
        task={taskWithAttachments}
        onChooseFiles={() => {}}
        onUpdatePurpose={() => {}}
        onDeleteAttachment={() => {}}
      />
    );
    const readOnlyHtml = renderToStaticMarkup(
      <TaskAttachmentsSection
        task={taskWithAttachments}
        readOnly
        onChooseFiles={() => {}}
        onUpdatePurpose={() => {}}
        onDeleteAttachment={() => {}}
      />
    );

    expect(editableHtml).toContain("Attach files");
    expect(editableHtml).toContain("Remove attachment");
    expect(readOnlyHtml).not.toContain("Attach files");
    expect(readOnlyHtml).not.toContain("Remove attachment");
  });

  it("shows the attach action in the empty state", () => {
    const html = renderToStaticMarkup(
      <TaskAttachmentsSection task={{ ...taskWithAttachments, attachments: [] }} onChooseFiles={() => {}} />
    );

    expect(html).toContain("No attachments yet.");
    expect(html).toContain("Attach files");
  });
});
