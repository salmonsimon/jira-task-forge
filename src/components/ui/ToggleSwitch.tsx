import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function ToggleSwitch({
  checked,
  label,
  description,
  hideLabel = false,
  disabled = false,
  checkedIcon,
  uncheckedIcon,
  onChange
}: {
  checked: boolean;
  label: string;
  description?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  checkedIcon?: ReactNode;
  uncheckedIcon?: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-pressed={checked}
      aria-label={hideLabel ? label : undefined}
      className={`app-toggle-switch group inline-flex min-w-0 items-center gap-3 text-left disabled:pointer-events-none disabled:opacity-50 ${
        hideLabel ? "shrink-0" : ""
      }`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`app-toggle-track inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-[2px] transition-colors ${
          checked ? "app-toggle-track-on justify-end" : "app-toggle-track-off justify-start"
        }`}
      >
        <span className="app-toggle-thumb inline-flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-transform">
          {checked ? checkedIcon ?? <Check size={13} strokeWidth={3} /> : uncheckedIcon ?? null}
        </span>
      </span>
      {hideLabel ? null : (
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-[#172b4d]">{label}</span>
          {description ? <span className="block text-xs leading-relaxed text-[#6b778c]">{description}</span> : null}
        </span>
      )}
    </button>
  );
}
