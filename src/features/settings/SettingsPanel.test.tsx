import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import { SettingsPanel } from "./SettingsPanel";

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
  catalogSourceUrl: "https://app.notion.com/p/capacitacion-interna-dts/JTF-Sync-Catalog-387c335aece481c292baf6991a86a5c3"
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
        onTestJiraApiTokenQuiet={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        onTestJiraConnectionSettings={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        hasNotionIntegrationToken={async () => true}
        onSaveNotionIntegrationToken={async () => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onTestNotionCatalogConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onListJiraProjectsForConnection={async () => []}
        onOpenJiraApiTokens={() => undefined}
        onOpenNotionDevelopers={() => undefined}
        onOpenAiProviderApiKeys={() => undefined}
        onExportBackup={() => undefined}
        onImportBackup={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(html.match(/>Setup<\/button>/g)).toHaveLength(2);
    expect(html).not.toContain("Set Connection");
    expect(html).not.toContain("Set Synchronization");
    expect(html).toContain("notion-mark");
    expect(html).toContain("h-5 w-5 shrink-0");
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
        onTestJiraApiTokenQuiet={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        onTestJiraConnectionSettings={async () => ({ ok: true, message: "Connected", accountDisplayName: null, accountEmail: null })}
        hasNotionIntegrationToken={async () => true}
        onSaveNotionIntegrationToken={async () => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onTestNotionCatalogConnection={async () => ({ ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 1 })}
        onListJiraProjectsForConnection={async () => []}
        onOpenJiraApiTokens={() => undefined}
        onOpenNotionDevelopers={() => undefined}
        onOpenAiProviderApiKeys={() => undefined}
        onExportBackup={() => undefined}
        onImportBackup={() => undefined}
        initialGuide="notion-synchronization"
        onClose={() => undefined}
      />
    );

    expect(html).toContain("Set Notion Synchronization");
    expect(html).toContain("Notion integration token");
    expect(html.match(/>Setup<\/button>/g)).toHaveLength(2);
  });
});
