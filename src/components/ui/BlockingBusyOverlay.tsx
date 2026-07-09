import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function BlockingBusyOverlay({
  detail,
  title,
  className
}: {
  detail?: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 z-20 flex items-center justify-center bg-[#091e42]/70 px-6 backdrop-blur-[2px]", className)}>
      <div className="w-full max-w-sm rounded border border-[#454852] bg-[#25272c] px-5 py-4 text-center shadow-2xl">
        <Loader2 className="mx-auto mb-3 animate-spin text-[#85b8ff]" size={24} />
        <div className="text-sm font-semibold text-[#f4f5f7]">{title}</div>
        {detail ? <div className="mt-1 text-xs leading-relaxed text-[#aeb3bd]">{detail}</div> : null}
      </div>
    </div>
  );
}
