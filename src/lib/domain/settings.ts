export type JiraTokenDraftTestStatus = "idle" | "testing" | "success" | "failed";

export type JiraTokenDraftControlInput = {
  accountEmail: string;
  isTestingConnection: boolean;
  siteUrl: string;
  tokenDraft: string;
  tokenTestStatus: JiraTokenDraftTestStatus;
};

export function getJiraTokenDraftControls(input: JiraTokenDraftControlInput) {
  const hasDraft = Boolean(input.tokenDraft.trim());
  const hasConnectionSettings = Boolean(input.siteUrl.trim() && input.accountEmail.trim());

  return {
    canSaveDraft: hasDraft && input.tokenTestStatus === "success" && !input.isTestingConnection,
    canTestDraft: hasDraft && hasConnectionSettings && !input.isTestingConnection,
    hasConnectionSettings,
    hasDraft
  };
}
