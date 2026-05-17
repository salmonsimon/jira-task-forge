import { Bug, CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import type { Priority, SyncStatus } from "../../lib/types";
import { cn } from "../../lib/utils";

export function AreaBadge({ area }: { area: string }) {
  return <span className="rounded bg-[#deebff] px-2 py-1 text-xs font-medium text-[#0747a6]">{area}</span>;
}

export function IssueTypeBadge({ type, dark = false }: { type: string; dark?: boolean }) {
  const icon = type === "Bug" ? <Bug size={12} /> : type === "Epic" ? <Sparkles size={12} /> : <ClipboardList size={12} />;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
        dark ? "bg-[#454852] text-[#dfe1e6]" : "bg-[#f4f5f7] text-[#42526e]"
      )}
    >
      {icon}
      {type}
    </span>
  );
}

export function PriorityBadge({ priority, dark = false }: { priority: Priority; dark?: boolean }) {
  const classes: Record<Priority, string> = {
    Lowest: "bg-[#f4f5f7] text-[#6b778c]",
    Low: "bg-[#e3fcef] text-[#006644]",
    Medium: "bg-[#deebff] text-[#0747a6]",
    High: "bg-[#fff0b3] text-[#974f0c]",
    Highest: "bg-[#ffebe6] text-[#bf2600]"
  };
  const darkClasses: Record<Priority, string> = {
    Lowest: "bg-[#454852] text-[#aeb3bd]",
    Low: "bg-[#183f2e] text-[#7ee2a8]",
    Medium: "bg-[#1d3b66] text-[#85b8ff]",
    High: "bg-[#533f04] text-[#f5cd47]",
    Highest: "bg-[#5d1f1a] text-[#ff9c8f]"
  };
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? darkClasses[priority] : classes[priority])}>{priority}</span>;
}

export function SyncBadge({ status, dark = false }: { status: SyncStatus; dark?: boolean }) {
  const classes: Record<SyncStatus, string> = {
    Pending: "bg-[#f4f5f7] text-[#42526e]",
    Failed: "bg-[#ffebe6] text-[#bf2600]",
    Exported: "bg-[#fff0b3] text-[#974f0c]",
    Created: "bg-[#e3fcef] text-[#006644]"
  };
  const darkClasses: Record<SyncStatus, string> = {
    Pending: "bg-[#454852] text-[#dfe1e6]",
    Failed: "bg-[#5d1f1a] text-[#ff9c8f]",
    Exported: "bg-[#533f04] text-[#f5cd47]",
    Created: "bg-[#183f2e] text-[#7ee2a8]"
  };
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? darkClasses[status] : classes[status])}>{status}</span>;
}

export function DescriptionBadge({ status, dark = false }: { status: "Ready" | "Missing" | "Draft"; dark?: boolean }) {
  if (status === "Ready") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
          dark ? "bg-[#183f2e] text-[#7ee2a8]" : "bg-[#e3fcef] text-[#006644]"
        )}
      >
        <CheckCircle2 size={12} />
        Ready
      </span>
    );
  }
  if (status === "Draft") {
    return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? "bg-[#533f04] text-[#f5cd47]" : "bg-[#fff0b3] text-[#974f0c]")}>Draft</span>;
  }
  return <span className={cn("rounded px-2 py-1 text-xs font-medium", dark ? "bg-[#454852] text-[#aeb3bd]" : "bg-[#f4f5f7] text-[#6b778c]")}>Missing</span>;
}

export function TrayStateBadge({ state }: { state: string }) {
  return <span className="rounded bg-[#f4f5f7] px-2 py-1 text-xs font-medium text-[#42526e]">{state}</span>;
}
