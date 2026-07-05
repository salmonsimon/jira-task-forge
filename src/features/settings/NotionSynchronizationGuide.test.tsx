import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import { catalogModeOptions, NotionSynchronizationGuide } from "./NotionSynchronizationGuide";

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
  it("starts with catalog source selection before token setup", () => {
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

    expect(html).toContain("Set Catalog Source");
    expect(html).toContain("Catalog source");
    expect(html).toContain("Catalog mode");
    expect(html).toContain("Notion page URL or ID");
    expect(html).not.toContain("New integration token");
    expect(html.indexOf("1. Source")).toBeLessThan(html.indexOf("2. Token"));
  });

  it("does not expose Notion token management before the source decision", () => {
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

    expect(html).not.toContain(">Manage token<");
    expect(html).not.toContain("href=\"https://www.notion.so/developers\"");
  });

  it("keeps manual catalog setup free of Notion token, URL, and test prompts", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={{ ...settings, catalogSourceMode: "manual", catalogSourceUrl: "" }}
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

    expect(html).toContain("Manual catalog");
    expect(html).toContain("No Notion token, page URL, or connection test is needed");
    expect(html).toContain("Use manual catalog");
    expect(html).toContain("grid-cols-1");
    expect(html).not.toContain("2. Token");
    expect(html).not.toContain("3. Review");
    expect(html).not.toContain("Notion page URL or ID");
    expect(html).not.toContain("New integration token");
    expect(html).not.toContain("Test source");
  });

  it("does not offer the legacy public exportable source mode", () => {
    expect(catalogModeOptions.map((option) => option.label)).toEqual(["Sync from Notion page", "Manual catalog"]);
    expect(catalogModeOptions.map((option) => option.value)).not.toContain("public-exportable");
  });
});
