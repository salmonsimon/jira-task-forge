import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function TaskFocusSection({
  title,
  count,
  actions,
  children
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2 text-base font-semibold text-[#f4f5f7]">
        <ChevronDown size={16} />
        {title}
        {typeof count === "number" ? (
          <span className="rounded bg-[#454852] px-1.5 py-0.5 text-xs text-[#dfe1e6]">{count}</span>
        ) : null}
        {actions ? <div className="ml-1 flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
