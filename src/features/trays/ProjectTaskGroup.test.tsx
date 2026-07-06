import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LocalTask, Tray } from "../../lib/types";
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

const tray: Tray = {
  id: "tray-1",
  name: "Workflow",
  state: "Active",
  epicScope: "Demo Version 1",
  transversalEpicScope: "Demos Version 1",
  summary: "1 task",
  updatedAt: "Just now",
  tasks: [task]
};

describe("ProjectTaskGroup", () => {
  it("lets inline area and issue type dropdown menus render above table rows", () => {
    const html = renderToStaticMarkup(
      <ProjectTaskGroup
        project="Transversal"
        tray={tray}
        tasks={[task]}
        areas={["3D", "Selección Recurso"]}
        onUpdateTrayEpicScopes={() => undefined}
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

  it("keeps editable inline selectors badge-sized instead of full cell width", () => {
    const html = renderToStaticMarkup(
      <ProjectTaskGroup
        project="STT"
        tray={tray}
        tasks={[{ ...task, area: "Bug", issueType: "Bug", priority: "Highest", syncStatus: "Failed" }]}
        areas={["Bug", "3D"]}
        onUpdateTrayEpicScopes={() => undefined}
        selectedTaskId={null}
        onOpenTask={() => undefined}
        onUpdateTask={() => undefined}
        onDuplicateTask={() => undefined}
        onDeleteTask={() => undefined}
        onOpenJiraIssue={() => undefined}
      />
    );

    expect(html).toContain("relative inline-block max-w-full align-middle");
    expect(html).toContain("inline-flex h-6 max-w-full items-center");
    expect(html).not.toContain("inline-flex w-full max-w-full items-center");
  });
});


it("keeps the Epic Scope editor available when the tray scope is TBD", () => {
  const html = renderToStaticMarkup(
    <ProjectTaskGroup
      project="STT"
      tray={{ ...tray, epicScope: "TBD", transversalEpicScope: undefined }}
      tasks={[{ ...task, project: "STT", area: "UI" }]}
      areas={["UI"]}
      onUpdateTrayEpicScopes={() => undefined}
      selectedTaskId={null}
      onOpenTask={() => undefined}
      onUpdateTask={() => undefined}
      onDuplicateTask={() => undefined}
      onDeleteTask={() => undefined}
      onOpenJiraIssue={() => undefined}
    />
  );

  expect(html).toContain("Scope:");
  expect(html).toContain("TBD");
  expect(html).toContain('aria-label="Edit epic scope for STT"');
});
