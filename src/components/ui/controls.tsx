import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function TopChip({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="app-top-chip inline-flex h-8 items-center gap-1.5 rounded-full border border-[#dfe1e6] bg-white px-3 text-xs font-medium text-[#42526e] hover:bg-[#f4f5f7]"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

export function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={cn(
        "h-9 border-b-2 px-3 text-sm font-medium",
        active ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-[#42526e] hover:text-[#172b4d]"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SelectLike({ value, width = "w-full" }: { value: string; width?: string }) {
  return (
    <button className={cn("flex h-9 items-center justify-between rounded border border-[#c1c7d0] bg-white px-3 text-sm", width)}>
      <span>{value}</span>
      <ChevronDown size={14} className="text-[#6b778c]" />
    </button>
  );
}

export function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded border border-[#c1c7d0] bg-[#f4f5f7] p-0.5">
      {options.map((option) => (
        <button
          className={cn(
            "h-7 rounded px-3 text-xs font-medium",
            value === option.value ? "bg-white text-[#172b4d] shadow-sm" : "text-[#42526e]"
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
