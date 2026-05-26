import { describe, expect, it } from "vitest";
import { getCredentialDraftControls } from "./settings";

describe("settings domain helpers", () => {
  it("requires a successful connection test before saving a new credential", () => {
    const baseInput = {
      hasConnectionSettings: true,
      hasSavedCredential: false,
      isTestingConnection: false,
      keyDraft: "new-key"
    };

    expect(getCredentialDraftControls({ ...baseInput, keyTestStatus: "idle" }).canSaveDraft).toBe(false);
    expect(getCredentialDraftControls({ ...baseInput, keyTestStatus: "failed" }).canSaveDraft).toBe(false);
    expect(getCredentialDraftControls({ ...baseInput, keyTestStatus: "success" }).canSaveDraft).toBe(true);
  });

  it("tests either the draft credential or the saved credential", () => {
    const baseInput = {
      hasConnectionSettings: true,
      isTestingConnection: false,
      keyTestStatus: "idle" as const
    };

    expect(
      getCredentialDraftControls({
        ...baseInput,
        hasSavedCredential: true,
        keyDraft: ""
      }).canTestConnection
    ).toBe(true);
    expect(
      getCredentialDraftControls({
        ...baseInput,
        hasSavedCredential: false,
        keyDraft: "new-key"
      }).canTestConnection
    ).toBe(true);
    expect(
      getCredentialDraftControls({
        ...baseInput,
        hasSavedCredential: true,
        hasConnectionSettings: false,
        keyDraft: "new-key"
      }).canTestConnection
    ).toBe(false);
  });
});
