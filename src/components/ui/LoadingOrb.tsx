import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function LoadingOrb({
  className,
  size = "md"
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const dimensions = {
    xs: {
      container: "h-5 w-5",
      outer: "h-4 w-4",
      inner: "h-3 w-3",
      icon: 9
    },
    sm: {
      container: "h-10 w-10",
      outer: "h-9 w-9",
      inner: "h-6 w-6",
      icon: 16
    },
    md: {
      container: "h-14 w-14",
      outer: "h-12 w-12",
      inner: "h-9 w-9",
      icon: 20
    }
  }[size];

  return (
    <div
      className={cn(
        "app-loading-orb relative flex shrink-0 items-center justify-center rounded-full border border-[#579dff]/30",
        dimensions.container,
        className
      )}
    >
      <div
        className={cn(
          "app-loading-ring app-loading-ring-fast absolute rounded-full border-2 border-[#315a8a] border-t-[#85b8ff]",
          dimensions.outer
        )}
      />
      <div
        className={cn(
          "app-loading-ring app-loading-ring-slow absolute rounded-full border border-[#579dff]/20 border-b-[#b7d5ff]",
          dimensions.inner
        )}
      />
      <Loader2 className="app-loading-icon text-[#85b8ff]" size={dimensions.icon} />
    </div>
  );
}
