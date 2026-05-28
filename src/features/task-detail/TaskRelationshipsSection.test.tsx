import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LocalTask } from "../../lib/types";
import { TaskRelationshipsSection } from "./TaskRelationshipsSection";

const sourceTask: LocalTask = {
  id: "source",
  project: "STT",
  area: "Polish",
  title: "Relationship source",
  priority: "High",
  issueType: "Story",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish",
  issueRelationships: [
    {
      id: "rel-source-blocked-by-blocker",
      type: "blocked_by",
      targetTaskId: "blocker"
    },
    {
      id: "rel-source-blocks-blocked",
      type: "blocks",
      targetTaskId: "blocked"
    }
  ]
};

const blockerTask: LocalTask = {
  id: "blocker",
  project: "STT",
  area: "Bug",
  title: "Validar flujo sin area",
  priority: "High",
  issueType: "Bug",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish"
};

const blockedTask: LocalTask = {
  id: "blocked",
  project: "STT",
  area: "Compra",
  title: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  priority: "Medium",
  issueType: "Story",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish"
};

describe("TaskRelationshipsSection", () => {
  it("groups relationships by direction and uses custom dark dropdown controls", () => {
    const html = renderToStaticMarkup(
      <TaskRelationshipsSection
        task={sourceTask}
        trayTasks={[sourceTask, blockerTask, blockedTask]}
        readOnly={false}
        onUpdateRelationships={() => undefined}
      />
    );

    expect(html).not.toContain("<select");
    expect(html.indexOf('data-relationship-group="blocked_by"')).toBeLessThan(
      html.indexOf('data-relationship-group="blocks"')
    );
    expect(html).toContain('aria-label="Relationship target"');
    expect(html).toContain("truncate");
  });
});
