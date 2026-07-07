import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import {
  JiraConnectionGuide,
  canContinueJiraConnectionGuideStep,
  jiraConnectionGuideCopy,
  jiraConnectionGuideSteps
} from "./JiraConnectionGuide";

const settings: AppSettings = {
  themeMode: "light",
  jiraSiteUrl: "https://salmonsimondts.atlassian.net",
  jiraAccountEmail: "simon.bahamonde@gmail.com",
  jiraAuthMethod: "api-token",
  jiraCreationProjectKey: "JTFTEST",
  aiProvider: "None",
  aiModel: "",
  defaultContentLanguage: "Spanish",
  catalogSourceMode: "manual",
  catalogSourceUrl: ""
};

function renderGuide({ initialStep }: { initialStep?: "site" | "account" | "token" | "verify" | "project" | "project-sync" | "review" } = {}) {
  return renderToStaticMarkup(
    <JiraConnectionGuide
      settings={settings}
      hasJiraApiToken={false}
      isTestingJiraConnection={false}
      onClose={() => undefined}
      onDeleteJiraApiToken={() => undefined}
      onListProjects={async () => []}
      onOpenJiraApiTokens={() => undefined}
      onSave={async () => true}
      onSaveJiraApiToken={async () => true}
      onTestConnection={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
      onTestJiraApiToken={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
      initialStep={initialStep}
    />
  );
}

describe("JiraConnectionGuide", () => {
  it("orders Token before Verify because full Jira verification needs a saved credential", () => {
    expect(jiraConnectionGuideSteps.map((candidate) => candidate.label)).toEqual([
      "Site",
      "Account",
      "Token",
      "Verify",
      "Project",
      "Decide",
      "Review"
    ]);

    const html = renderGuide();
    expect(html.indexOf("3. Token")).toBeLessThan(html.indexOf("4. Verify"));
    expect(html.indexOf("4. Verify")).toBeLessThan(html.indexOf("5. Project"));
    expect(html).toContain("whitespace-nowrap");
  });

  it("keeps the Project sync switch at the end of the Project step", () => {
    const html = renderGuide({ initialStep: "project" });

    expect(html).toContain("Use Project sync");
    expect(html).toContain("app-toggle-track-on");
    expect(html).not.toContain('type="checkbox"');
    expect(html.indexOf("Project key")).toBeLessThan(html.indexOf("Use Project sync"));
  });

  it("uses the Decide step for decision-list guidance instead of the toggle", () => {
    const html = renderGuide({ initialStep: "project-sync" });

    expect(html).toContain("Project decisions");
    expect(html).toContain("Load Jira Projects");
    expect(html).toContain("Load Projects");
    expect(html).not.toContain("Use Project sync");
  });

  it("keeps Token responsible for testing and saving credentials", () => {
    expect(jiraConnectionGuideCopy.tokenDescription).toContain("Save or replace the Jira API token");
    expect(jiraConnectionGuideCopy.tokenDraftPending).toContain("save it before continuing");
    expect(jiraConnectionGuideCopy.tokenDraftPassed).toContain("Save it so Verify can use it");
    expect(jiraConnectionGuideCopy.savedTokenReady).toContain("replace it, or continue to Verify");
  });

  it("describes Verify as a full saved-token connection check, not site/email-only validation", () => {
    expect(jiraConnectionGuideCopy.verifyDescription).toContain("full Jira Cloud connection check");
    expect(jiraConnectionGuideCopy.verifyDescription).toContain("saved API token");
    expect(jiraConnectionGuideCopy.verifyTokenMissing).toContain("does not test site and email by themselves");
  });

  it("requires the Token step to save or clear a replacement before Verify can continue", () => {
    const readyInput = {
      hasValidSiteUrl: true,
      hasAccountEmail: true,
      hasJiraApiToken: true,
      hasUnsavedTokenDraft: false,
      isSavingToken: false,
      hasProjectKey: true
    };

    expect(canContinueJiraConnectionGuideStep({ ...readyInput, step: "token" })).toBe(true);
    expect(canContinueJiraConnectionGuideStep({ ...readyInput, step: "token", hasUnsavedTokenDraft: true })).toBe(false);
    expect(canContinueJiraConnectionGuideStep({ ...readyInput, step: "token", hasJiraApiToken: false })).toBe(false);
    expect(canContinueJiraConnectionGuideStep({ ...readyInput, step: "verify", hasJiraApiToken: false })).toBe(false);
  });
});
