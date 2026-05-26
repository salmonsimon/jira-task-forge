export type CredentialDraftTestStatus = "idle" | "testing" | "success" | "failed";

export type CredentialDraftControlInput = {
  hasConnectionSettings: boolean;
  hasSavedCredential: boolean;
  isTestingConnection: boolean;
  keyDraft: string;
  keyTestStatus: CredentialDraftTestStatus;
};

export function getCredentialDraftControls(input: CredentialDraftControlInput) {
  const hasDraft = Boolean(input.keyDraft.trim());

  return {
    canSaveDraft: hasDraft && input.keyTestStatus === "success" && !input.isTestingConnection,
    canTestConnection:
      input.hasConnectionSettings &&
      !input.isTestingConnection &&
      (hasDraft || input.hasSavedCredential),
    hasConnectionSettings: input.hasConnectionSettings,
    hasDraft
  };
}

export type JiraTokenDraftTestStatus = CredentialDraftTestStatus;
