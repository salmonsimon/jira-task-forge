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
  expect(html).toContain("title=\"Update official area catalog\"");
  expect(html.match(/>New</g)).toHaveLength(1);
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

  expect(html).not.toContain(">Sync<");
  expect(html.match(/>New</g)).toHaveLength(2);
  expect(html).toContain("Rename Bug");
  expect(html).toContain("Delete Bug");
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
  expect(html).toContain("title=\"Update official area catalog\"");
  expect(html).not.toContain("Rename Bug");
  expect(html).not.toContain("Delete Bug");
});

it("keeps official projects read-only while syncing from Notion", () => {
  const html = renderToStaticMarkup(
    <CategoriesPanel
      projects={[
        project,
        { ...project, id: "project-hidden-official", name: "Legacy Sandbox", hidden: true },
        { ...project, id: "project-local", name: "Local Project", source: "local" }
      ]}
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

  expect(html.match(/>New</g)).toHaveLength(1);
  expect(html).toContain("Official");
  expect(html).not.toContain("Rename DTS");
  expect(html).not.toContain("Hide DTS");
  expect(html).not.toContain("Delete DTS");
  expect(html).not.toContain("Show Legacy Sandbox");
  expect(html).not.toContain(">Hidden<");
  expect(html).toContain("Rename Local Project");
  expect(html).toContain("Hide Local Project");
  expect(html).toContain("Delete Local Project");
});
