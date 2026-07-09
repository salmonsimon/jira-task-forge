import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import { SettingsPanel, shouldSyncAreaCatalogAfterCatalogSettingsSave } from "./SettingsPanel";

const settings: AppSettings = {
  themeMode: "light",
  jiraSiteUrl: "https://salmonsimondts.atlassian.net",
  jiraAccountEmail: "simon.bahamonde@gmail.com",
  jiraAuthMethod: "api-token",
  jiraCreationProjectKey: "JTFTEST",
  aiProvider: "None",
  aiModel: "",
  defaultContentLanguage: "Spanish",
  catalogSourceMode: "notion",
  catalogSourceUrl: "https://app.notion.com/p/387c335aece481c292baf6991a86a5c3"
};

describe("SettingsPanel", () => {
  it("keeps Jira and Notion setup actions compact and uses the Notion mark asset", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        settings={settings}
        hasJiraApiToken
        hasAiProviderApiKey={false}
        aiCredentialMessage={null}
        isTestingJiraConnection={false}
        isTestingAiProviderConnection={false}
        onChange={async () => true}
        onSaveJiraApiToken={async () => true}
        onDeleteJiraApiToken={() => undefined}
        onSaveAiProviderApiKey={async () => true}
        onDeleteAiProviderApiKey={() => undefined}
        onTestAiProviderConnection={async () => ({ ok: true, message: "Connected" })}
        onTestAiProviderApiKey={async () => ({ ok: true, message: "Connected" })}
        onListAiProviderModels={async () => ["gpt-4.1", "gpt-4.1-mini", "o3-mini"]}
        onTestJiraApiTokenQuiet={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        onTestJiraConnectionSettings={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        hasNotionIntegrationToken={async () => true}
        onDeleteNotionIntegrationToken={async () => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onTestNotionCatalogConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onSyncAreaCatalog={async () => undefined}
        onListJiraProjectsForConnection={async () => []}
        onOpenJiraApiTokens={() => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onOpenAiProviderApiKeys={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(html).toContain('data-overlay-scrim="drawer"');
    expect(html.match(/>Setup<\/button>/g)).toHaveLength(3);
    expect(html).not.toContain("Set Connection");
    expect(html).not.toContain("Set Synchronization");
    expect(html).toContain("notion-mark");
    expect(html).toContain("h-5 w-5 shrink-0");
    expect(html).not.toContain("Backup and restore");
    expect(html).not.toContain("Export backup");
    expect(html).not.toContain("Import backup");
  });

  it("can open the Notion synchronization guide directly", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        settings={settings}
        hasJiraApiToken
        hasAiProviderApiKey={false}
        aiCredentialMessage={null}
        isTestingJiraConnection={false}
        isTestingAiProviderConnection={false}
        onChange={async () => true}
        onSaveJiraApiToken={async () => true}
        onDeleteJiraApiToken={() => undefined}
        onSaveAiProviderApiKey={async () => true}
        onDeleteAiProviderApiKey={() => undefined}
        onTestAiProviderConnection={async () => ({ ok: true, message: "Connected" })}
        onTestAiProviderApiKey={async () => ({ ok: true, message: "Connected" })}
        onListAiProviderModels={async () => ["gpt-4.1", "gpt-4.1-mini", "o3-mini"]}
        onTestJiraApiTokenQuiet={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        onTestJiraConnectionSettings={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        hasNotionIntegrationToken={async () => true}
        onDeleteNotionIntegrationToken={async () => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onTestNotionCatalogConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onSyncAreaCatalog={async () => undefined}
        onListJiraProjectsForConnection={async () => []}
        onOpenJiraApiTokens={() => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onOpenAiProviderApiKeys={() => undefined}
        initialGuide="notion-synchronization"
        onClose={() => undefined}
      />
    );

    expect(html).toContain("Set Catalog Source");
    expect(html).toContain("Catalog source");
    expect(html).toContain("Catalog mode");
    expect(html).not.toContain("Paste Notion integration token");
    expect(html.match(/>Setup<\/button>/g)).toHaveLength(3);
  });

  it("can open the Jira connection guide directly", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        settings={settings}
        hasJiraApiToken={false}
        hasAiProviderApiKey={false}
        aiCredentialMessage={null}
        isTestingJiraConnection={false}
        isTestingAiProviderConnection={false}
        onChange={async () => true}
        onSaveJiraApiToken={async () => true}
        onDeleteJiraApiToken={() => undefined}
        onSaveAiProviderApiKey={async () => true}
        onDeleteAiProviderApiKey={() => undefined}
        onTestAiProviderConnection={async () => ({ ok: true, message: "Connected" })}
        onTestAiProviderApiKey={async () => ({ ok: true, message: "Connected" })}
        onListAiProviderModels={async () => ["gpt-4.1", "gpt-4.1-mini", "o3-mini"]}
        onTestJiraApiTokenQuiet={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        onTestJiraConnectionSettings={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        hasNotionIntegrationToken={async () => true}
        onDeleteNotionIntegrationToken={async () => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onTestNotionCatalogConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onSyncAreaCatalog={async () => undefined}
        onListJiraProjectsForConnection={async () => []}
        onOpenJiraApiTokens={() => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onOpenAiProviderApiKeys={() => undefined}
        initialGuide="jira-connection"
        onClose={() => undefined}
      />
    );

    expect(html).toContain("Set Jira Connection");
    expect(html).toContain("Jira site");
    expect(html.match(/>Setup<\/button>/g)).toHaveLength(3);
  });

  it("can open the AI provider setup guide directly", () => {
    const html = renderToStaticMarkup(
      <SettingsPanel
        settings={{ ...settings, aiProvider: "OpenAI", aiModel: "gpt-4.1" }}
        hasJiraApiToken
        hasAiProviderApiKey={false}
        aiCredentialMessage={null}
        isTestingJiraConnection={false}
        isTestingAiProviderConnection={false}
        onChange={async () => true}
        onSaveJiraApiToken={async () => true}
        onDeleteJiraApiToken={() => undefined}
        onSaveAiProviderApiKey={async () => true}
        onDeleteAiProviderApiKey={() => undefined}
        onTestAiProviderConnection={async () => ({ ok: true, message: "Connected" })}
        onTestAiProviderApiKey={async () => ({ ok: true, message: "Connected" })}
        onListAiProviderModels={async () => ["gpt-4.1", "gpt-4.1-mini", "o3-mini"]}
        onTestJiraApiTokenQuiet={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        onTestJiraConnectionSettings={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        hasNotionIntegrationToken={async () => true}
        onDeleteNotionIntegrationToken={async () => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onTestNotionCatalogConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onSyncAreaCatalog={async () => undefined}
        onListJiraProjectsForConnection={async () => []}
        onOpenJiraApiTokens={() => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onOpenAiProviderApiKeys={() => undefined}
        initialGuide="ai-provider"
        onClose={() => undefined}
      />
    );

    expect(html).toContain("Set AI Provider");
    expect(html).toContain("Provider");
    expect(html).toContain("AI provider");
    expect(html).toContain("Default model");
    expect(html).toContain("gpt-4.1");
  });

  it("syncs Areas after saving Notion catalog settings", () => {
    expect(
      shouldSyncAreaCatalogAfterCatalogSettingsSave(true, {
        catalogSourceMode: "notion",
        catalogSourceUrl: "https://app.notion.com/p/387c335aece481c292baf6991a86a5c3"
      })
    ).toBe(true);
    expect(shouldSyncAreaCatalogAfterCatalogSettingsSave(true, { catalogSourceMode: "manual", catalogSourceUrl: "" })).toBe(false);
    expect(shouldSyncAreaCatalogAfterCatalogSettingsSave(false, { catalogSourceMode: "notion" })).toBe(false);
  });
});
