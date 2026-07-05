import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type FeedbackNoteVariant = "info" | "success" | "warning" | "error";
export type FeedbackNoteSurface = "light" | "dark";

const lightVariantClasses: Record<FeedbackNoteVariant, string> = {
  info: "border-[#85b8ff] bg-[#deebff] text-[#0747a6]",
  success: "border-[#abf5d1] bg-[#e3fcef] text-[#006644]",
  warning: "border-[#f5cd47] bg-[#fff7d6] text-[#974f0c]",
  error: "border-[#ffbdad] bg-[#ffebe6] text-[#bf2600]"
};

const darkVariantClasses: Record<FeedbackNoteVariant, string> = {
  info: "border-[#315a8a] bg-[#102d50] text-[#b7d5ff]",
  success: "border-[#216e4e] bg-[#143c2b] text-[#7ee2a8]",
  warning: "border-[#7f5f01] bg-[#3f3102] text-[#f5cd47]",
  error: "border-[#ae2e24] bg-[#4f1d1a] text-[#ffb8ad]"
};

// Hybrid feedback contract:
// - Passive, always-visible helper copy stays as quiet inline text.
// - Actionable results, warnings, errors, and success states use FeedbackNote.
// - Use surface="dark" inside dark dialogs/panels instead of local one-off colors.
export function FeedbackNote({
  children,
  className,
  surface = "light",
  variant
}: {
  children: ReactNode;
  className?: string;
  surface?: FeedbackNoteSurface;
  variant: FeedbackNoteVariant;
}) {
  return (
    <div
      className={feedbackNoteClassName({
        className: cn("px-3 py-2 text-xs font-medium leading-relaxed", className),
        surface,
        variant
      })}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function feedbackNoteClassName({
  className,
  surface = "light",
  variant
}: {
  className?: string;
  surface?: FeedbackNoteSurface;
  variant: FeedbackNoteVariant;
}) {
  const variantClasses = surface === "dark" ? darkVariantClasses[variant] : lightVariantClasses[variant];
  return cn("rounded border", variantClasses, className);
}
