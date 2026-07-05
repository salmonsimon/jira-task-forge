import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import { NotionSynchronizationGuide } from "./NotionSynchronizationGuide";

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

describe("NotionSynchronizationGuide", () => {
  it("uses an app action for token management and lets the token banner wrap", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={settings}
        hasNotionIntegrationToken={async () => false}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenNotionDevelopers={() => undefined}
        onSaveNotionIntegrationToken={async () => undefined}
        onTestNotionCatalogConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
      />
    );

    expect(html).toContain(">Manage token<");
    expect(html).toContain("flex-col gap-3 sm:flex-row sm:items-start sm:justify-between");
    expect(html).toContain("settings-button-secondary w-full justify-center sm:w-auto sm:shrink-0");
    expect(html).not.toContain("href=\"https://www.notion.so/developers\"");
  });
});
