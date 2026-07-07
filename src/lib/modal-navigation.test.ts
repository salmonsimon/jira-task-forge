import { describe, expect, it, vi } from "vitest";
import { getModalMouseNavigationIntent, isMouseNavigationButton, shouldHandleEnterAsWizardAdvance } from "./modal-navigation";

describe("modal navigation helpers", () => {
  it("maps mouse side buttons only when the active modal can move in that direction", () => {
    expect(getModalMouseNavigationIntent(3, { canGoBack: true, canGoForward: true })).toBe("back");
    expect(getModalMouseNavigationIntent(4, { canGoBack: true, canGoForward: true })).toBe("forward");
    expect(getModalMouseNavigationIntent(3, { canGoBack: false, canGoForward: true })).toBeNull();
    expect(getModalMouseNavigationIntent(4, { canGoBack: true, canGoForward: false })).toBeNull();
    expect(getModalMouseNavigationIntent(0, { canGoBack: true, canGoForward: true })).toBeNull();
  });

  it("identifies browser back and forward mouse buttons", () => {
    expect(isMouseNavigationButton(3)).toBe(true);
    expect(isMouseNavigationButton(4)).toBe(true);
    expect(isMouseNavigationButton(0)).toBe(false);
    expect(isMouseNavigationButton(1)).toBe(false);
    expect(isMouseNavigationButton(2)).toBe(false);
  });

  it("keeps Enter navigation out of real textareas and buttons", () => {
    class FakeHTMLElement {
      isContentEditable = false;
    }
    class FakeTextAreaElement extends FakeHTMLElement {}
    class FakeButtonElement extends FakeHTMLElement {}
    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    vi.stubGlobal("HTMLTextAreaElement", FakeTextAreaElement);
    vi.stubGlobal("HTMLButtonElement", FakeButtonElement);

    expect(shouldHandleEnterAsWizardAdvance(new FakeHTMLElement() as unknown as EventTarget)).toBe(true);
    expect(shouldHandleEnterAsWizardAdvance(new FakeTextAreaElement() as unknown as EventTarget)).toBe(false);
    expect(shouldHandleEnterAsWizardAdvance(new FakeButtonElement() as unknown as EventTarget)).toBe(false);

    const editable = new FakeHTMLElement();
    editable.isContentEditable = true;
    expect(shouldHandleEnterAsWizardAdvance(editable as unknown as EventTarget)).toBe(false);
    vi.unstubAllGlobals();
  });
});
