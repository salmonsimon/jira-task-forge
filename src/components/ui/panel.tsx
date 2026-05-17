import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

export function PanelHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-[#dfe1e6] px-4 py-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-[#6b778c]">{subtitle}</p>
      </div>
      <IconButton title="Close" onClick={onClose}>
        <X size={16} />
      </IconButton>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-[#6b778c]">{label}</div>
      <div className="rounded border border-[#dfe1e6] bg-[#f7f8fa] px-2 py-1.5 text-sm">{value}</div>
    </div>
  );
}

export function DetailBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded border border-[#dfe1e6] p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
