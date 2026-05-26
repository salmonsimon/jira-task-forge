import { useCallback, useId, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export const appOverlayLayers = {
  sidePanel: 30,
  focusedTask: 40,
  modal: 50,
  notice: 60,
  centeredNotice: 65,
  nestedModal: 70
} as const;

export type AppOverlayDismissReason = "escape" | "backdrop" | "outside-pointer";
export type AppOverlayDismissEvent = Event | ReactPointerEvent<HTMLElement>;

export type AppOverlayRegistration = {
  id: string;
  layer: number;
  onDismiss?: (reason: AppOverlayDismissReason) => void;
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  dismissOnOutsidePointer?: boolean;
  lockScroll?: boolean;
  getSurfaceElement?: () => HTMLElement | null;
  shouldDismiss?: (reason: AppOverlayDismissReason, event?: AppOverlayDismissEvent) => boolean;
};

export type RegisteredAppOverlay = Required<
  Pick<AppOverlayRegistration, "dismissOnEscape" | "dismissOnBackdrop" | "dismissOnOutsidePointer" | "lockScroll">
> &
  Omit<AppOverlayRegistration, "dismissOnEscape" | "dismissOnBackdrop" | "dismissOnOutsidePointer" | "lockScroll"> & {
    sequence: number;
  };

export function createAppOverlayStack() {
  let nextSequence = 0;
  const overlays = new Map<string, RegisteredAppOverlay>();
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function normalize(registration: AppOverlayRegistration): RegisteredAppOverlay {
    return {
      ...registration,
      dismissOnEscape: registration.dismissOnEscape ?? false,
      dismissOnBackdrop: registration.dismissOnBackdrop ?? false,
      dismissOnOutsidePointer: registration.dismissOnOutsidePointer ?? false,
      lockScroll: registration.lockScroll ?? false,
      sequence: overlays.get(registration.id)?.sequence ?? nextSequence++
    };
  }

  function getOrderedOverlays() {
    return [...overlays.values()].sort((left, right) => left.layer - right.layer || left.sequence - right.sequence);
  }

  function getTopmostOverlay() {
    const orderedOverlays = getOrderedOverlays();
    return orderedOverlays[orderedOverlays.length - 1] ?? null;
  }

  function canDismiss(overlay: RegisteredAppOverlay, reason: AppOverlayDismissReason) {
    if (reason === "escape") return overlay.dismissOnEscape;
    if (reason === "backdrop") return overlay.dismissOnBackdrop;
    return overlay.dismissOnOutsidePointer;
  }

  function requestDismiss(id: string, reason: AppOverlayDismissReason, event?: AppOverlayDismissEvent) {
    const overlay = overlays.get(id);
    if (!overlay || getTopmostOverlay()?.id !== id || !canDismiss(overlay, reason)) return false;
    if (overlay.shouldDismiss && !overlay.shouldDismiss(reason, event)) return false;
    overlay.onDismiss?.(reason);
    return true;
  }

  return {
    register(registration: AppOverlayRegistration) {
      overlays.set(registration.id, normalize(registration));
      notify();

      return () => {
        overlays.delete(registration.id);
        notify();
      };
    },
    update(registration: AppOverlayRegistration) {
      if (!overlays.has(registration.id)) return;
      overlays.set(registration.id, normalize(registration));
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getTopmostOverlay,
    isTopmost(id: string) {
      return getTopmostOverlay()?.id === id;
    },
    hasScrollLock() {
      return [...overlays.values()].some((overlay) => overlay.lockScroll);
    },
    size() {
      return overlays.size;
    },
    requestDismiss,
    dismissTopmost(reason: AppOverlayDismissReason, event?: AppOverlayDismissEvent) {
      const overlay = getTopmostOverlay();
      if (!overlay) return false;
      return requestDismiss(overlay.id, reason, event);
    }
  };
}

export const appOverlayStack = createAppOverlayStack();

type UseAppOverlayOptions = Omit<AppOverlayRegistration, "id" | "getSurfaceElement"> & {
  enabled?: boolean;
  surfaceRef?: RefObject<HTMLElement | null>;
};

export function useAppOverlay({
  enabled = true,
  surfaceRef,
  ...registration
}: UseAppOverlayOptions) {
  const generatedId = useId();
  const id = `app-overlay-${generatedId}`;
  const registrationRef = useRef<AppOverlayRegistration>({
    ...registration,
    id,
    getSurfaceElement: () => surfaceRef?.current ?? null
  });

  registrationRef.current = {
    ...registration,
    id,
    getSurfaceElement: () => surfaceRef?.current ?? null
  };

  useLayoutEffect(() => {
    if (!enabled) return;
    return appOverlayStack.register(registrationRef.current);
  }, [enabled, id]);

  useLayoutEffect(() => {
    if (!enabled) return;
    appOverlayStack.update(registrationRef.current);
  });

  const onBackdropPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.stopPropagation();
      if (event.target !== event.currentTarget) return;
      appOverlayStack.requestDismiss(id, "backdrop", event);
    },
    [id]
  );

  const onSurfacePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  return {
    id,
    isTopmost: () => appOverlayStack.isTopmost(id),
    backdropProps: {
      onPointerDown: onBackdropPointerDown
    },
    surfaceProps: {
      onPointerDown: onSurfacePointerDown
    }
  };
}

let isListeningToDocument = false;
let restoredScrollStyles: { bodyOverflow: string; htmlOverflow: string } | null = null;

appOverlayStack.subscribe(syncOverlayEnvironment);

function syncOverlayEnvironment() {
  syncOverlayKeyboardAndPointerListeners();
  syncOverlayScrollLock();
}

function syncOverlayKeyboardAndPointerListeners() {
  if (typeof window === "undefined") return;

  const shouldListen = appOverlayStack.size() > 0;
  if (shouldListen === isListeningToDocument) return;

  if (shouldListen) {
    window.addEventListener("keydown", handleOverlayKeyDown);
    window.addEventListener("pointerdown", handleOverlayPointerDown);
  } else {
    window.removeEventListener("keydown", handleOverlayKeyDown);
    window.removeEventListener("pointerdown", handleOverlayPointerDown);
  }
  isListeningToDocument = shouldListen;
}

function syncOverlayScrollLock() {
  if (typeof document === "undefined") return;

  const shouldLockScroll = appOverlayStack.hasScrollLock();
  if (shouldLockScroll && !restoredScrollStyles) {
    restoredScrollStyles = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return;
  }

  if (!shouldLockScroll && restoredScrollStyles) {
    document.body.style.overflow = restoredScrollStyles.bodyOverflow;
    document.documentElement.style.overflow = restoredScrollStyles.htmlOverflow;
    restoredScrollStyles = null;
  }
}

function handleOverlayKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;

  if (appOverlayStack.dismissTopmost("escape", event)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function handleOverlayPointerDown(event: PointerEvent) {
  const topmostOverlay = appOverlayStack.getTopmostOverlay();
  if (!topmostOverlay?.dismissOnOutsidePointer) return;

  const surfaceElement = topmostOverlay.getSurfaceElement?.();
  const targetNode = event.target instanceof Node ? event.target : null;
  if (!surfaceElement || !targetNode || surfaceElement.contains(targetNode)) return;

  appOverlayStack.requestDismiss(topmostOverlay.id, "outside-pointer", event);
}
