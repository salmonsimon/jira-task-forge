import { describe, expect, it } from "vitest";
import {
  effectiveEpicScopeForProject,
  epicTargetForTask,
  formatEpicTarget,
  formatPendingEpicTarget,
  normalizeEpicScope,
  suggestTransversalEpicScope
} from "./epicScope";

describe("epic scope domain module", () => {
  it("normalizes TBD without brackets", () => {
    expect(normalizeEpicScope("[TBD]")).toBe("TBD");
    expect(normalizeEpicScope(" tbd ")).toBe("TBD");
  });

  it("requires confirmed Transversal scope unless singular scope is TBD", () => {
    expect(effectiveEpicScopeForProject("STT", { epicScope: "Demo Version 1" })).toBe("Demo Version 1");
    expect(effectiveEpicScopeForProject("Transversal", { epicScope: "Demo Version 1" })).toBeNull();
    expect(effectiveEpicScopeForProject("Transversal", { epicScope: "TBD" })).toBe("TBD");
  });

  it("formats current epic targets from project area and scope", () => {
    const target = epicTargetForTask(
      { project: "STT", area: "Programacion" },
      { epicScope: "Demo Version 1" }
    );

    expect(target).toEqual({ project: "STT", area: "Programacion", scope: "Demo Version 1" });
    expect(target ? formatEpicTarget(target) : null).toBe("[STT] [Programacion] Demo Version 1");
    expect(formatPendingEpicTarget("STT", "Programacion")).toBe("[STT] [Programacion] Scope pending");
  });

  it("suggests editable Transversal plural scopes without pluralizing TBD", () => {
    expect(suggestTransversalEpicScope("Demo Versión 1")).toBe("Demos Versión 1");
    expect(suggestTransversalEpicScope("Animación")).toBe("Animaciones");
    expect(suggestTransversalEpicScope("[TBD]")).toBe("TBD");
  });
});
