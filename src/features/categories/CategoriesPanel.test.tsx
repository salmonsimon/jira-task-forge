import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category } from "../../lib/types";
import { CategoriesPanel, createManualCatalogSyncResult, isMissingNotionSynchronizationSetup } from "./CategoriesPanel";

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

    expect(html).toMatch(/<aside[^>]*class="[^"]*\bflex-col\b/);
  });
});


it("shows catalog-managed areas as refreshable instead of manually creatable", () => {
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

it("creates a visible manual catalog sync result when the fallback path returns no backend notice", () => {
  expect(createManualCatalogSyncResult([area, { ...area, id: "area-polish", name: "Polish" }])).toMatchObject({
    ok: true,
    sourceUrl: "manual",
    syncedAreaCount: 2,
    deliveryFormatCount: 0,
    ruleCount: 0,
    warnings: [],
    errors: []
  });
});
