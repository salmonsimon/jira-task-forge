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

export type JiraSiteUrlValidation =
  | { ok: true; value: string; changed: boolean; message: string }
  | { ok: false; value: string; message: string };

export function validateJiraSiteUrlDraft(rawSiteUrl: string): JiraSiteUrlValidation {
  const value = rawSiteUrl.trim();
  if (!value) {
    return { ok: false, value, message: "Jira site URL is required." };
  }
  if (/\s/.test(rawSiteUrl)) {
    return { ok: false, value, message: "Jira site URL must not include whitespace." };
  }
  if (!value.startsWith("https://")) {
    return { ok: false, value, message: "Use the Atlassian Cloud site root starting with https://." };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, value, message: "Enter a valid Jira site URL." };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, value, message: "Jira site URL must not include credentials." };
  }
  if (parsed.port) {
    return { ok: false, value, message: "Jira site URL must not include a port." };
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return { ok: false, value, message: "Use the site root only, without paths, query strings, or fragments." };
  }

  const host = parsed.hostname.toLowerCase();
  const site = host.endsWith(".atlassian.net") ? host.slice(0, -".atlassian.net".length) : "";
  if (!site || site.includes(".") || site.startsWith("-") || site.endsWith("-") || !/^[a-z0-9-]+$/.test(site)) {
    return { ok: false, value, message: "Use a standard Atlassian Cloud host, for example https://your-site.atlassian.net." };
  }

  const normalized = `https://${host}`;
  return {
    ok: true,
    value: normalized,
    changed: normalized !== value,
    message: normalized === value ? "Site URL looks valid." : `This will be saved as ${normalized}.`
  };
}
