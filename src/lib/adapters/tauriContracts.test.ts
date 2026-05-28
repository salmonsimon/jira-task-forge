import { describe, expect, it } from "vitest";
import {
  mapBackendAssistedDescriptionProposal,
  mapBackendCategory,
  mapBackendDescriptionProposalLogEntry,
  mapBackendSyncAuditEvent,
  mapBackendTask,
  mapBackendTray,
  type BackendAssistedDescriptionProposal,
  type BackendCategory,
  type BackendDescriptionProposalLogEntry,
  type BackendSyncAuditEvent,
  type BackendTask,
  type BackendTray
} from "./tauriContracts";

describe("Tauri command contract mappers", () => {
  it("maps Rust task payload fields into the frontend Local Task model", () => {
    const task: BackendTask = {
      id: "task-1",
      tray_id: "tray-1",
      project: "STT",
      area: "Bug",
      title: "Resolver problema timer",
      priority: "High",
      issue_type: "Bug",
      sync_status: "Created",
      description_status: "Ready",
      description: null,
      content_language: "Spanish",
      jira_key: "JTFTEST-123",
      jira_url: "https://dts.atlassian.net/browse/JTFTEST-123",
      epic_key: null,
      parent_task_id: "parent-1",
      task_order: 2,
      created_at: "2026-05-26T12:00:00Z",
      updated_at: "2026-05-26T12:00:00Z"
    };

    expect(mapBackendTask(task)).toEqual({
      id: "task-1",
      project: "STT",
      area: "Bug",
      title: "Resolver problema timer",
      priority: "High",
      issueType: "Bug",
      syncStatus: "Created",
      descriptionStatus: "Ready",
      description: undefined,
      language: "Spanish",
      jiraKey: "JTFTEST-123",
      jiraUrl: "https://dts.atlassian.net/browse/JTFTEST-123",
      epic: undefined,
      parentTaskId: "parent-1"
    });
  });

  it("maps tray state and summary from backend trays plus mapped tasks", () => {
    const tray: BackendTray = {
      id: "tray-1",
      name: "Live QA",
      state: "NeedsAttention",
      created_at: "2026-05-26T12:00:00Z",
      updated_at: "invalid-local-date",
      archived_at: null
    };

    expect(
      mapBackendTray(tray, [
        {
          id: "task-1",
          project: "STT",
          area: "Bug",
          title: "Resolver problema timer",
          priority: "High",
          issueType: "Bug",
          syncStatus: "Failed",
          descriptionStatus: "Missing",
          language: "Spanish"
        },
        {
          id: "task-2",
          project: "STT",
          area: "Bug",
          title: "Recolectar referencias",
          priority: "High",
          issueType: "Sub-task",
          syncStatus: "Pending",
          descriptionStatus: "Ready",
          language: "Spanish",
          parentTaskId: "task-1"
        }
      ])
    ).toMatchObject({
      id: "tray-1",
      name: "Live QA",
      state: "Needs attention",
      summary: "1 task · 1 sub-task · 1 failed",
      updatedAt: "invalid-local-date"
    });
  });

  it("keeps category and sync audit mappings in the contract seam", () => {
    const category: BackendCategory = {
      id: "category-1",
      category_type: "area",
      name: "Programacion",
      source: "jira",
      hidden: true,
      ignored: false,
      created_at: "2026-05-26T12:00:00Z",
      updated_at: "2026-05-26T12:00:00Z"
    };
    const event: BackendSyncAuditEvent = {
      id: "event-1",
      syncAttemptId: "attempt-1",
      trayId: "tray-1",
      taskId: "task-1",
      eventType: "jira.parent.created",
      occurredAt: "invalid-local-date",
      outcome: "succeeded",
      provider: "jira",
      operation: "create_issue",
      detail: { jiraKey: "JTFTEST-123", summary: "[Bug] Resolver problema timer", priority: "High" }
    };

    expect(mapBackendCategory(category)).toEqual({
      id: "category-1",
      categoryType: "area",
      name: "Programacion",
      source: "jira",
      hidden: true
    });
    expect(mapBackendSyncAuditEvent(event)).toEqual({
      id: "event-1",
      timestamp: "invalid-local-date",
      event: "Succeeded: Parent Created",
      detail: "JTFTEST-123 · [Bug] Resolver problema timer · Priority High"
    });
  });

  it("keeps assisted description proposal metadata separate from task descriptions", () => {
    const proposal: BackendAssistedDescriptionProposal = {
      id: "proposal-1",
      taskId: "task-1",
      title: "Timer proposal",
      summary: "SRS Lite draft",
      status: "Pending",
      provider: "OpenAI",
      model: "gpt-4.1",
      userComment: "Focus risk notes.",
      sections: [
        {
          sectionId: "user_story",
          heading: "Historia de usuario",
          currentContent: "",
          proposedContent: "Como QA, quiero validar el timer.",
          status: "Raw",
          updatedAt: "2026-05-27T12:00:00Z"
        }
      ],
      createdAt: "2026-05-27T12:00:00Z",
      updatedAt: "2026-05-27T12:00:00Z",
      decidedAt: null
    };
    const logEntry: BackendDescriptionProposalLogEntry = {
      id: "log-1",
      taskId: "task-1",
      proposalId: "proposal-1",
      eventType: "description.proposal.created",
      title: "Timer proposal",
      summary: "SRS Lite draft",
      status: "Pending",
      provider: "OpenAI",
      model: "gpt-4.1",
      userComment: null,
      detail: { sectionCount: 11 },
      occurredAt: "2026-05-27T12:01:00Z"
    };

    expect(mapBackendAssistedDescriptionProposal(proposal)).toEqual(proposal);
    expect(mapBackendDescriptionProposalLogEntry(logEntry)).toEqual(logEntry);
  });
});
