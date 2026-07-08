import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistedDescriptionProposal, NewAssistedDescriptionProposal } from "../types";
import {
  createPersistedAssistedDescriptionProposal,
  completePersistedNotionOAuthConnection,
  openPersistedNotionOAuthAuthorizationUrl,
  startPersistedNotionOAuthConnection,
  testPersistedNotionCatalogConnection,
  testPersistedJiraApiToken,
  transitionPersistedAssistedDescriptionProposal,
  updatePersistedAssistedDescriptionProposalSection
} from "./tauriPersistence";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

const invokeMock = vi.mocked(invoke);

describe("Tauri persistence assisted description proposals", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("creates proposals with the frontend/backend camelCase payload shape", async () => {
    const payload: NewAssistedDescriptionProposal = {
      taskId: "task-1",
      title: "Timer proposal",
      summary: "Draft DTS Jira description",
      provider: "OpenAI",
      model: "gpt-4.1",
      userComment: "Focus context notes.",
      sections: [
        {
          sectionId: "user_story",
          heading: "Historia de usuario",
          currentContent: "",
          proposedContent: "Como QA, quiero validar el timer.",
          status: "Raw",
          updatedAt: "2026-05-27T12:00:00Z"
        }
      ]
    };
    const persisted = proposalFixture({
      taskId: payload.taskId,
      title: payload.title ?? "Timer proposal",
      summary: payload.summary,
      provider: payload.provider,
      model: payload.model,
      userComment: payload.userComment,
      sections: payload.sections
    });
    invokeMock.mockResolvedValueOnce(persisted);

    await expect(createPersistedAssistedDescriptionProposal(payload)).resolves.toEqual(persisted);
    expect(invokeMock).toHaveBeenCalledWith("create_assisted_description_proposal", payload);
  });

  it("updates proposal sections without applying to the task unless requested", async () => {
    const persisted = proposalFixture({ taskId: "task-1", sections: [] });
    invokeMock.mockResolvedValueOnce(persisted);

    await updatePersistedAssistedDescriptionProposalSection("proposal-1", "problem", {
      proposedContent: "Nuevo problema.",
      status: "Raw",
      reviewerComment: "Needs narrower wording."
    });

    expect(invokeMock).toHaveBeenCalledWith("update_assisted_description_proposal_section", {
      proposalId: "proposal-1",
      sectionId: "problem",
      proposedContent: "Nuevo problema.",
      status: "Raw",
      reviewerComment: "Needs narrower wording.",
      applyToTaskDescription: false
    });
  });

  it("asks accepted and partial transitions to apply reviewed content to the task description", async () => {
    const persisted = proposalFixture({ taskId: "task-1", status: "Accepted", sections: [] });
    invokeMock.mockResolvedValueOnce(persisted);

    await transitionPersistedAssistedDescriptionProposal("proposal-1", "Accepted");

    expect(invokeMock).toHaveBeenCalledWith("transition_assisted_description_proposal", {
      proposalId: "proposal-1",
      status: "Accepted",
      reviewerComment: undefined,
      applyToTaskDescription: true
    });
  });

  it("passes draft Jira site and account email when testing a new token", async () => {
    const result = { ok: true, message: "Connected", accountDisplayName: "Saimon", accountEmail: "saimon@example.com" };
    invokeMock.mockResolvedValueOnce(result);

    await expect(testPersistedJiraApiToken("token-123", "https://example.atlassian.net", "saimon@example.com")).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("test_jira_api_token", {
      token: "token-123",
      siteUrl: "https://example.atlassian.net",
      accountEmail: "saimon@example.com"
    });
  });

  it("tests a draft Notion token without invoking the saved-token connection command", async () => {
    const result = { ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 12 };
    invokeMock.mockResolvedValueOnce(result);

    await expect(testPersistedNotionCatalogConnection("https://app.notion.com/page-id", "ntn_draft")).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("test_notion_catalog_connection_with_token", {
      pageUrlOrId: "https://app.notion.com/page-id",
      token: "ntn_draft"
    });
  });

  it("uses the saved Notion token command when no draft token is provided", async () => {
    const result = { ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 12 };
    invokeMock.mockResolvedValueOnce(result);

    await expect(testPersistedNotionCatalogConnection("https://app.notion.com/page-id")).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("test_notion_catalog_connection", {
      pageUrlOrId: "https://app.notion.com/page-id"
    });
  });

  it("starts Notion OAuth without passing desktop secrets", async () => {
    const result = {
      authorizationUrl: "https://api.notion.com/v1/oauth/authorize?client_id=public-client&state=state-123",
      state: "state-123"
    };
    invokeMock.mockResolvedValueOnce(result);

    await expect(startPersistedNotionOAuthConnection()).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("start_notion_oauth_connection");
  });

  it("opens Notion OAuth authorization URLs through the native external-link command", async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(
      openPersistedNotionOAuthAuthorizationUrl("https://api.notion.com/v1/oauth/authorize?client_id=public-client&response_type=code&redirect_uri=https://example.test&state=state-123")
    ).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("open_notion_oauth_authorization_url", {
      url: "https://api.notion.com/v1/oauth/authorize?client_id=public-client&response_type=code&redirect_uri=https://example.test&state=state-123"
    });
  });

  it("completes Notion OAuth through the backend exchange before testing the selected page", async () => {
    const result = { ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 12 };
    invokeMock.mockResolvedValueOnce(result);

    await expect(
      completePersistedNotionOAuthConnection("oauth-code", "state-123", "https://app.notion.com/page-id")
    ).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("complete_notion_oauth_connection", {
      authorizationCode: "oauth-code",
      state: "state-123",
      pageUrlOrId: "https://app.notion.com/page-id"
    });
  });
});

function proposalFixture(
  patch: Partial<Omit<AssistedDescriptionProposal, "sections" | "taskId">> &
    Pick<AssistedDescriptionProposal, "sections" | "taskId">
): AssistedDescriptionProposal {
  const base: AssistedDescriptionProposal = {
    id: "proposal-1",
    taskId: patch.taskId,
    title: "Timer proposal",
    summary: "Draft DTS Jira description",
    status: patch.status ?? "Pending",
    provider: "OpenAI",
    model: "gpt-4.1",
    userComment: null,
    sections: patch.sections,
    createdAt: "2026-05-27T12:00:00Z",
    updatedAt: "2026-05-27T12:00:00Z",
    decidedAt: null
  };
  return {
    ...base,
    ...patch,
    taskId: patch.taskId,
    sections: patch.sections
  };
}
