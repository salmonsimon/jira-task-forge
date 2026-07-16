import { describe, expect, it } from "vitest";
import { createDefaultAppSettings, getCredentialDraftControls, validateJiraSiteUrlDraft } from "./settings";

describe("settings domain helpers", () => {
  it("starts with Notion sync selected but without bundled connection URLs", () => {
    expect(createDefaultAppSettings()).toMatchObject({
      jiraSiteUrl: "",
      catalogSourceMode: "notion",
      catalogSourceUrl: ""
    });
  });

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

  it("normalizes standard Atlassian Cloud site roots", () => {
    expect(validateJiraSiteUrlDraft("https://DTS.atlassian.net/")).toEqual({
      ok: true,
      value: "https://dts.atlassian.net",
      changed: true,
      message: "This will be saved as https://dts.atlassian.net."
    });
  });

  it("rejects non-root or non-standard Jira URLs", () => {
    expect(validateJiraSiteUrlDraft("https://dts.atlassian.net/browse/DTS-1")).toMatchObject({
      ok: false,
      message: "Use the site root only, without paths, query strings, or fragments."
    });
    expect(validateJiraSiteUrlDraft("https://jira.example.com")).toMatchObject({
      ok: false,
      message: "Use a standard Atlassian Cloud host, for example https://your-site.atlassian.net."
    });
  });
});
