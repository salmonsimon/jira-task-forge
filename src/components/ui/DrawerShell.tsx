import type { HTMLAttributes, ReactNode, RefObject } from "react";
import type { useAppOverlay } from "../../lib/app-overlays";
import { cn } from "../../lib/utils";

type AppOverlayHandle = ReturnType<typeof useAppOverlay>;

export function DrawerShell({
  children,
  overlay,
  surfaceRef,
  className
}: {
  children: ReactNode;
  overlay: AppOverlayHandle;
  surfaceRef: RefObject<HTMLElement | null>;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex justify-end bg-[rgba(9,30,66,0.42)]"
      data-overlay-scrim="drawer"
      {...overlay.backdropProps}
    >
      <aside
        ref={surfaceRef}
        className={cn(
          "flex h-screen w-[420px] flex-col overscroll-contain border-l border-[#dfe1e6] bg-white shadow-xl",
          className
        )}
        {...(overlay.surfaceProps as HTMLAttributes<HTMLElement>)}
      >
        {children}
      </aside>
    </div>
  );
}
