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
      container: "h-4 min-w-5 gap-0.5",
      dot: "h-1 w-1"
    },
    sm: {
      container: "h-10 min-w-10 gap-1.5",
      dot: "h-1.5 w-1.5"
    },
    md: {
      container: "h-14 min-w-14 gap-2",
      dot: "h-2 w-2"
    }
  }[size];

  return (
    <div
      className={cn(
        "app-loading-dots inline-flex shrink-0 items-center justify-center text-[#85b8ff]",
        dimensions.container,
        className
      )}
      role="status"
    >
      <span className={cn("app-loading-dot rounded-full bg-current", dimensions.dot)} />
      <span className={cn("app-loading-dot rounded-full bg-current", dimensions.dot)} />
      <span className={cn("app-loading-dot rounded-full bg-current", dimensions.dot)} />
    </div>
  );
}
