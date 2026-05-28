import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LocalTask } from "../../lib/types";
import { ProjectTaskGroup } from "./ProjectTaskGroup";

const task: LocalTask = {
  id: "task-1",
  project: "Transversal",
  area: "3D",
  title: "Validar dropdowns inline",
  priority: "Medium",
  issueType: "Story",
  syncStatus: "Pending",
  descriptionStatus: "Ready",
  language: "Spanish"
};

describe("ProjectTaskGroup", () => {
  it("lets inline area and issue type dropdown menus render above table rows", () => {
    const html = renderToStaticMarkup(
      <ProjectTaskGroup
        project="Transversal"
        tasks={[task]}
        areas={["3D", "Compra"]}
        selectedTaskId={null}
        onOpenTask={() => undefined}
        onUpdateTask={() => undefined}
        onDuplicateTask={() => undefined}
        onDeleteTask={() => undefined}
        onOpenJiraIssue={() => undefined}
      />
    );

    expect(html.match(/<td class="min-w-0 overflow-visible px-3 py-2">/g)).toHaveLength(2);
  });
});
