import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistedDescriptionProposal, NewAssistedDescriptionProposal } from "../types";
import {
  createPersistedAssistedDescriptionProposal,
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
      summary: "Draft SRS Lite description",
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
});

function proposalFixture(
  patch: Partial<Omit<AssistedDescriptionProposal, "sections" | "taskId">> &
    Pick<AssistedDescriptionProposal, "sections" | "taskId">
): AssistedDescriptionProposal {
  const base: AssistedDescriptionProposal = {
    id: "proposal-1",
    taskId: patch.taskId,
    title: "Timer proposal",
    summary: "Draft SRS Lite description",
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
