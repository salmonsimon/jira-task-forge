import { describe, expect, it } from "vitest";
import { getJiraTokenDraftControls } from "./settings";

describe("settings domain helpers", () => {
  it("requires a successful connection test before saving a new Jira token", () => {
    const baseInput = {
      accountEmail: "saimon@example.com",
      isTestingConnection: false,
      siteUrl: "https://example.atlassian.net",
      tokenDraft: "new-token"
    };

    expect(getJiraTokenDraftControls({ ...baseInput, tokenTestStatus: "idle" }).canSaveDraft).toBe(false);
    expect(getJiraTokenDraftControls({ ...baseInput, tokenTestStatus: "failed" }).canSaveDraft).toBe(false);
    expect(getJiraTokenDraftControls({ ...baseInput, tokenTestStatus: "success" }).canSaveDraft).toBe(true);
  });
});
