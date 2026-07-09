import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateTrayDialog } from "./CreateTrayDialog";

describe("CreateTrayDialog", () => {
  it("asks for tray name and Epic Scope before creating a tray", () => {
    const html = renderToStaticMarkup(
      <CreateTrayDialog
        onClose={() => undefined}
        onCreateTray={() => undefined}
        onSuggestTransversalScope={async () => "Demos Versión 1"}
      />
    );

    expect(html).toContain("Create Tray");
    expect(html).toContain("1. Tray scope");
    expect(html).toContain("2. Transversal");
    expect(html).toContain("Tray name");
    expect(html).toContain("Epic Scope");
    expect(html).toContain("Enter Epic Scope");
    expect(html).not.toContain("Demo Versión 1 or TBD");
    expect(html).toContain("[Project] [Area]");
  });

  it("shows the AI provider setup action when assisted suggestions are not configured", () => {
    const html = renderToStaticMarkup(
      <CreateTrayDialog
        onClose={() => undefined}
        onCreateTray={() => undefined}
        onConfigureAiProvider={() => undefined}
        onSuggestTransversalScope={async () => "Demos Versión 1"}
        isAiProviderConfigured={false}
        initialStep="transversal"
        initialTrayName="Demo prep"
        initialEpicScope="Demo"
      />
    );

    expect(html).toContain("Set up AI provider");
    expect(html).not.toContain("Suggest with AI");
  });
});
