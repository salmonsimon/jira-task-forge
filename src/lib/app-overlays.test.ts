import { describe, expect, it } from "vitest";
import { createAppOverlayStack } from "./app-overlays";

describe("app overlay stack", () => {
  it("dismisses only the topmost overlay for a dismiss reason", () => {
    const stack = createAppOverlayStack();
    const dismissed: string[] = [];

    const unregisterPanel = stack.register({
      id: "settings",
      layer: 30,
      dismissOnOutsidePointer: true,
      onDismiss: () => dismissed.push("settings")
    });
    const unregisterNotice = stack.register({
      id: "connection-notice",
      layer: 60,
      dismissOnBackdrop: true,
      onDismiss: () => dismissed.push("connection-notice")
    });

    expect(stack.requestDismiss("settings", "outside-pointer")).toBe(false);
    expect(stack.requestDismiss("connection-notice", "backdrop")).toBe(true);
    expect(dismissed).toEqual(["connection-notice"]);

    unregisterNotice();

    expect(stack.requestDismiss("settings", "outside-pointer")).toBe(true);
    expect(dismissed).toEqual(["connection-notice", "settings"]);

    unregisterPanel();
  });

  it("uses layer, then mount order, for topmost overlay selection", () => {
    const stack = createAppOverlayStack();

    const unregisterFirstModal = stack.register({ id: "first-modal", layer: 50 });
    const unregisterSecondModal = stack.register({ id: "second-modal", layer: 50 });
    const unregisterFocusedTask = stack.register({ id: "focused-task", layer: 40 });

    expect(stack.getTopmostOverlay()?.id).toBe("second-modal");
    expect(stack.isTopmost("focused-task")).toBe(false);

    unregisterSecondModal();

    expect(stack.getTopmostOverlay()?.id).toBe("first-modal");

    unregisterFocusedTask();
    unregisterFirstModal();
  });

  it("does not fall through to a lower overlay when the topmost overlay blocks dismissal", () => {
    const stack = createAppOverlayStack();
    const dismissed: string[] = [];

    const unregisterFocusWindow = stack.register({
      id: "focus-window",
      layer: 40,
      dismissOnEscape: true,
      onDismiss: () => dismissed.push("focus-window")
    });
    const unregisterBusyPreflight = stack.register({
      id: "busy-preflight",
      layer: 50,
      dismissOnEscape: false,
      onDismiss: () => dismissed.push("busy-preflight")
    });

    expect(stack.dismissTopmost("escape")).toBe(false);
    expect(dismissed).toEqual([]);

    unregisterBusyPreflight();

    expect(stack.dismissTopmost("escape")).toBe(true);
    expect(dismissed).toEqual(["focus-window"]);

    unregisterFocusWindow();
  });

  it("dismisses a catalog sync notice before the Categories drawer", () => {
    const stack = createAppOverlayStack();
    const dismissed: string[] = [];

    const unregisterDrawer = stack.register({
      id: "categories-drawer",
      layer: 30,
      dismissOnEscape: true,
      onDismiss: () => dismissed.push("categories-drawer")
    });
    const unregisterNotice = stack.register({
      id: "catalog-sync-notice",
      layer: 65,
      dismissOnEscape: true,
      onDismiss: () => dismissed.push("catalog-sync-notice")
    });

    expect(stack.dismissTopmost("escape")).toBe(true);
    expect(dismissed).toEqual(["catalog-sync-notice"]);

    unregisterNotice();

    expect(stack.dismissTopmost("escape")).toBe(true);
    expect(dismissed).toEqual(["catalog-sync-notice", "categories-drawer"]);

    unregisterDrawer();
  });

  it("keeps scroll locking active while any registered overlay requests it", () => {
    const stack = createAppOverlayStack();

    const unregisterNotice = stack.register({ id: "notice", layer: 60, lockScroll: false });
    expect(stack.hasScrollLock()).toBe(false);

    const unregisterDialog = stack.register({ id: "dialog", layer: 50, lockScroll: true });
    expect(stack.hasScrollLock()).toBe(true);

    unregisterNotice();
    expect(stack.hasScrollLock()).toBe(true);

    unregisterDialog();
    expect(stack.hasScrollLock()).toBe(false);
  });

  it("lets an overlay predicate keep focus-sensitive Escape handling local", () => {
    const stack = createAppOverlayStack();
    const dismissed: string[] = [];

    const unregisterOverlay = stack.register({
      id: "task-focus",
      layer: 40,
      dismissOnEscape: true,
      shouldDismiss: () => false,
      onDismiss: () => dismissed.push("task-focus")
    });

    expect(stack.dismissTopmost("escape")).toBe(false);
    expect(dismissed).toEqual([]);

    unregisterOverlay();
  });
});
