import { appOverlayStack } from "./app-overlays";

export type ModalMouseNavigation = {
  canGoBack: boolean;
  canGoForward: boolean;
};

export function getModalMouseNavigationIntent(button: number, navigation: ModalMouseNavigation): "back" | "forward" | null {
  if (button === 3 && navigation.canGoBack) return "back";
  if (button === 4 && navigation.canGoForward) return "forward";
  return null;
}

export function shouldHandleEnterAsWizardAdvance(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  if (target instanceof HTMLTextAreaElement) return false;
  if (target instanceof HTMLButtonElement) return false;
  if (target.isContentEditable) return false;
  return true;
}

export function isEventInsideTopmostOverlaySurface(event: MouseEvent): boolean {
  const surface = appOverlayStack.getTopmostOverlay()?.getSurfaceElement?.();
  return Boolean(surface && event.target instanceof Node && surface.contains(event.target));
}
