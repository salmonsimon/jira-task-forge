import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category } from "../../lib/types";
import { CategoriesPanel } from "./CategoriesPanel";

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
        onCreateCategory={() => undefined}
        onDeleteCategory={() => undefined}
        onUpdateCategory={() => undefined}
        onClose={() => undefined}
      />
    );

    expect(html).toMatch(/<aside[^>]*class="[^"]*\bflex-col\b/);
  });
});
