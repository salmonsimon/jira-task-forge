import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Tray } from "../../lib/types";
import { TraySelector } from "./TraySelector";

const tray: Tray = {
  id: "tray-1",
  name: "Launch prep",
  state: "Active",
  summary: "2 local tasks",
  updatedAt: "Today",
  tasks: []
};

function renderTraySelector() {
  return renderToStaticMarkup(
    <TraySelector
      trays={[tray]}
      onOpenTray={() => undefined}
      onCreateTray={() => undefined}
      onRenameTray={() => undefined}
      onArchiveTray={() => undefined}
      onRestoreTray={() => undefined}
      onDeleteTray={() => undefined}
      showArchived={false}
      onToggleArchived={() => undefined}
    />
  );
}

function hasNestedButton(html: string) {
  let depth = 0;
  const buttonTags = html.matchAll(/<\/?button\b[^>]*>/g);

  for (const [tag] of buttonTags) {
    if (tag.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth > 0) return true;
    depth += 1;
  }

  return false;
}

describe("TraySelector", () => {
  it("keeps tray cards keyboard-openable without nesting action buttons inside another button", () => {
    const html = renderTraySelector();

    expect(html).toContain('aria-label="Open tray Launch prep"');
    expect(html).toContain('title="Rename tray"');
    expect(html).toContain('title="Archive tray"');
    expect(html).toContain('title="Delete tray"');
    expect(hasNestedButton(html)).toBe(false);
  });
});
