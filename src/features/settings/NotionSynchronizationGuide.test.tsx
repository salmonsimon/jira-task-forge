import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppSettings } from "../../lib/types";
import {
  canSaveNotionSynchronization,
  canCompleteNotionOAuth,
  canTestNotionCatalogSource,
  catalogModeOptions,
  notionCatalogSourceRequirementsUrl,
  NotionSynchronizationGuide,
  verifyNotionTokenBeforeSynchronization
} from "./NotionSynchronizationGuide";

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

describe("NotionSynchronizationGuide", () => {
  it("starts with catalog source selection before Notion connection setup", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={settings}
        hasNotionIntegrationToken={async () => false}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
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
    expect(html).toContain("Continue to connect Notion, then confirm the dedicated catalog page before saving.");
    expect(html).not.toContain("Notion page URL or ID");
    expect(html).not.toContain("New integration token");
    expect(html.indexOf("1. Source")).toBeLessThan(html.indexOf("2. Connect"));
    expect(html.indexOf("2. Connect")).toBeLessThan(html.indexOf("3. Catalog page"));
    expect(html.indexOf("3. Catalog page")).toBeLessThan(html.indexOf("4. Review"));
  });

  it("does not expose Notion token management before the source decision", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={settings}
        hasNotionIntegrationToken={async () => false}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
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

  it("uses OAuth-specific test and save language in the Connect step", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={settings}
        hasNotionIntegrationToken={async () => false}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({ ok: true, message: "Connection saved" })}
        onTestNotionCatalogConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
        initialStep="connect"
      />
    );

    expect(html).toContain("OAuth callback codes are single-use");
    expect(html).toContain("Test &amp; save code");
    expect(html).toContain("Delete connection");
    expect(html).not.toContain("Remove connection");
    expect(html).not.toContain("Finish connection");
  });

  it("keeps catalog page selection and source testing in the Catalog page step", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={settings}
        hasNotionIntegrationToken={async () => true}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({ ok: true, message: "Connection saved" })}
        onTestNotionCatalogConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
        initialStep="catalog"
      />
    );

    expect(html).toContain("Selected catalog page URL or ID");
    expect(html).toContain("Test source");
    expect(html).toContain("must pass validation before synchronization can be saved");
    expect(html).not.toContain("Finish connection");
  });

  it("keeps manual catalog setup free of Notion token, URL, and test prompts", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={{ ...settings, catalogSourceMode: "manual", catalogSourceUrl: "" }}
        hasNotionIntegrationToken={async () => false}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
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
    expect(html).not.toContain("2. Connect");
    expect(html).not.toContain("3. Review");
    expect(html).not.toContain("4. Review");
    expect(html).not.toContain("Notion page URL or ID");
    expect(html).not.toContain("View source requirements");
    expect(html).not.toContain("New integration token");
    expect(html).not.toContain("Test source");
  });

  it("does not offer the legacy public exportable source mode", () => {
    expect(catalogModeOptions.map((option) => option.label)).toEqual(["Sync from Notion page", "Manual catalog"]);
    expect(catalogModeOptions.map((option) => option.value)).not.toContain("public-exportable");
  });

  it("requires a successful Notion connection test before saving Notion synchronization", () => {
    expect(canSaveNotionSynchronization("manual", null)).toBe(true);
    expect(canSaveNotionSynchronization("notion", null)).toBe(false);
    expect(canSaveNotionSynchronization("notion", { ok: false, message: "Failed", title: null, extractedBlockCount: 0 })).toBe(false);
    expect(canSaveNotionSynchronization("notion", { ok: true, message: "Connected", title: "JTF Sync Catalog", extractedBlockCount: 12 })).toBe(true);
  });

  it("keeps Notion OAuth completion blocked until code and state are present", () => {
    expect(canCompleteNotionOAuth("manual", "code", "state", false)).toBe(false);
    expect(canCompleteNotionOAuth("notion", "", "state", false)).toBe(false);
    expect(canCompleteNotionOAuth("notion", "code", null, false)).toBe(false);
    expect(canCompleteNotionOAuth("notion", "code", "state", true)).toBe(false);
    expect(canCompleteNotionOAuth("notion", "code", "state", false)).toBe(true);
  });

  it("disables Notion source testing until the page and a saved OAuth token are available", () => {
    expect(canTestNotionCatalogSource("notion", "", false, false)).toBe(false);
    expect(canTestNotionCatalogSource("notion", settings.catalogSourceUrl, false, false)).toBe(false);
    expect(canTestNotionCatalogSource("notion", settings.catalogSourceUrl, true, false)).toBe(true);
    expect(canTestNotionCatalogSource("notion", settings.catalogSourceUrl, true, true)).toBe(false);
    expect(canTestNotionCatalogSource("manual", "", false, false)).toBe(true);
  });

  it("rechecks the saved Notion token before final synchronization save", async () => {
    await expect(verifyNotionTokenBeforeSynchronization("notion", async () => true)).resolves.toEqual({ ok: true });
    await expect(verifyNotionTokenBeforeSynchronization("notion", async () => false)).resolves.toEqual({
      ok: false,
      message: "Reconnect Notion before saving synchronization. The saved connection is not available yet."
    });
  });

  it("does not require a Notion token recheck for manual catalog saves", async () => {
    let checked = false;

    await expect(
      verifyNotionTokenBeforeSynchronization("manual", async () => {
        checked = true;
        return false;
      })
    ).resolves.toEqual({ ok: true });
    expect(checked).toBe(false);
  });

  it("allows Notion OAuth to start before a catalog page URL is entered", () => {
    const html = renderToStaticMarkup(
      <NotionSynchronizationGuide
        settings={{ ...settings, catalogSourceUrl: "" }}
        hasNotionIntegrationToken={async () => false}
        onChangeCatalogSettings={async () => true}
        onClose={() => undefined}
        onDeleteNotionIntegrationToken={async () => undefined}
        onOpenCatalogSourceRequirements={() => undefined}
        onStartNotionOAuthConnection={async () => ({ authorizationUrl: "https://api.notion.com/v1/oauth/authorize?state=state-123", state: "state-123" })}
        onOpenNotionOAuthAuthorizationUrl={async () => undefined}
        onCompleteNotionOAuthConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
        onTestNotionCatalogConnection={async () => ({
          ok: true,
          message: "Connected",
          title: "JTF Sync Catalog",
          extractedBlockCount: 1
        })}
      />
    );

    expect(html).toContain("Continue");
    expect(html).not.toContain("Complete the Token step first");
  });
});
