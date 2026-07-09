import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category } from "../../lib/types";
import { CategoriesPanel, createCatalogSyncErrorResult, isMissingNotionSynchronizationSetup } from "./CategoriesPanel";

const project: Category = {
  id: "project-dts",
  categoryType: "project",
  name: "DTS",
  source: "jira"
};

const area: Category = {
  id: "area-bug",
  categoryType: "area",
  name: "Bug",
  source: "local"
};

describe("CategoriesPanel", () => {
  it("stacks the header above the category lists", () => {
    const html = renderToStaticMarkup(
      <CategoriesPanel
        projects={[project]}
        areas={[area]}
        catalogSourceMode="public-exportable"
        catalogSourceUrl=""
        onCreateCategory={() => undefined}
        onDeleteCategory={() => undefined}
        onUpdateCategory={() => undefined}
        onSyncAreaCatalog={async () => null}
        onConfigureCatalogSource={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(html).toContain('data-overlay-scrim="drawer"');
    expect(html).toMatch(/<aside[^>]*class="[^"]*\bflex-col\b/);
  });
});


it("shows externally managed areas as refreshable instead of manually creatable", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[project]}
      areas={[{ ...area, source: "catalog" }]}
      catalogSourceMode="public-exportable"
      catalogSourceUrl=""
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain(">Sync<");
  expect(html).toContain("Area sync enabled");
  expect(html).toContain("title=\"Sync Areas from Notion catalog\"");
  expect(html).toContain("title=\"Switch Areas to manual mode before adding\"");
  expect(html.match(/>New</g)).toHaveLength(2);
  expect(html).not.toContain("Rename Bug");
  expect(html).not.toContain("Delete Bug");
});

it("detects missing Notion setup failures from catalog sync", () => {
  expect(
    isMissingNotionSynchronizationSetup("notion", {
      ok: false,
      sourceUrl: "",
      syncedAreaCount: 0,
      deliveryFormatCount: 0,
      ruleCount: 0,
      warnings: [],
      errors: ["Save a Notion integration token before syncing the catalog."],
      areas: [],
      deliveryFormats: [],
      areaFormatRules: []
    })
  ).toBe(true);

  expect(
    isMissingNotionSynchronizationSetup("public-exportable", {
      ok: false,
      sourceUrl: "",
      syncedAreaCount: 0,
      deliveryFormatCount: 0,
      ruleCount: 0,
      warnings: [],
      errors: ["Save a Notion integration token before syncing the catalog."],
      areas: [],
      deliveryFormats: [],
      areaFormatRules: []
    })
  ).toBe(false);
});

it("detects missing Notion setup from rejected Tauri sync errors", () => {
  const result = createCatalogSyncErrorResult(new Error("Save a Notion integration token before syncing the catalog."));

  expect(isMissingNotionSynchronizationSetup("notion", result)).toBe(true);
});

it("renders manual catalog areas as editable local categories", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[project]}
      areas={[area]}
      catalogSourceMode="manual"
      catalogSourceUrl=""
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain("Project sync enabled");
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("app-toggle-track-on");
  expect(html).toContain("title=\"Sync Projects from Jira epics\"");
  expect(html).toContain("Manual Areas mode");
  expect(html).toContain("title=\"Enable area sync before syncing\"");
  expect(html).toContain("title=\"New Area\"");
  expect(html.match(/>New</g)).toHaveLength(2);
  expect(html).toContain("Rename Bug");
  expect(html).toContain("Delete Bug");
});

it("keeps Transversal visible and read-only even in manual Projects mode", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[{ id: "project-transversal", categoryType: "project", name: "Transversal", source: "local" }]}
      areas={[]}
      catalogSourceMode="manual"
      catalogSourceUrl=""
      projectSyncEnabled={false}
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain("Transversal");
  expect(html).toContain("Manual Projects mode");
  expect(html).not.toContain("Rename Transversal");
  expect(html).not.toContain("Delete Transversal");
  expect(html).not.toContain("Hide Transversal");
  expect(html).toContain("text-right text-xs text-[#6b778c]\">local</span>");
});

it("blocks manual Project creation while Jira Project sync is enabled", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[project]}
      areas={[]}
      catalogSourceMode="manual"
      catalogSourceUrl=""
      projectSyncEnabled
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain("Project sync enabled");
  expect(html).toContain("title=\"Disable Project sync before adding manual Projects\"");
  expect(html).toContain("disabled");
});

it("places edit and delete actions before the right-aligned source label", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[{ id: "project-manual", categoryType: "project", name: "Manual Project", source: "local" }]}
      areas={[]}
      catalogSourceMode="manual"
      catalogSourceUrl=""
      projectSyncEnabled={false}
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).not.toContain("Hide Manual Project");
  expect(html).toContain("Rename Manual Project");
  expect(html).toContain("Delete Manual Project");
  expect(html.indexOf("Rename Manual Project")).toBeLessThan(html.indexOf(">local</span>"));
  expect(html.indexOf("Delete Manual Project")).toBeLessThan(html.indexOf(">local</span>"));
});

it("keeps Notion catalog areas synchronized instead of manually editable", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[project]}
      areas={[{ ...area, source: "catalog" }]}
      catalogSourceMode="notion"
      catalogSourceUrl="https://app.notion.com/p/example"
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain(">Sync<");
  expect(html).toContain("Area sync enabled");
  expect(html).toContain("title=\"Sync Areas from Notion catalog\"");
  expect(html).not.toContain("Rename Bug");
  expect(html).not.toContain("Delete Bug");
});

it("explains empty synced Areas and offers sync/manual choices", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[project]}
      areas={[]}
      catalogSourceMode="notion"
      catalogSourceUrl="https://app.notion.com/p/example"
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain("No Areas set yet.");
  expect(html).toContain("Sync from the Notion catalog, or switch to manual mode to add Areas.");
  expect(html).toContain("Area sync enabled");
  expect(html).toContain("title=\"Sync Areas from Notion catalog\"");
  expect(html).toContain("title=\"Switch Areas to manual mode before adding\"");
});

it("explains empty manual Areas and disables sync until sync mode is enabled", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[project]}
      areas={[]}
      catalogSourceMode="manual"
      catalogSourceUrl=""
      onCreateCategory={() => undefined}
      onDeleteCategory={() => undefined}
      onUpdateCategory={() => undefined}
      onSyncAreaCatalog={async () => null}
      onConfigureCatalogSource={() => undefined}
      onClose={() => undefined}
    />
  );

  expect(html).toContain("No Areas set yet.");
  expect(html).toContain("Use New to add Areas, or enable sync to load options from the Notion catalog.");
  expect(html).toContain("Manual Areas mode");
  expect(html).toContain("title=\"Enable area sync before syncing\"");
  expect(html).toContain("title=\"New Area\"");
});
