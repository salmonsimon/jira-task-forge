import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Button({
  children,
  icon,
  variant = "primary",
  ...buttonProps
}: {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "darkPrimary" | "darkSecondary" | "darkGhost";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...buttonProps}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-[#0052cc] text-white hover:bg-[#0747a6]",
        variant === "secondary" && "border border-[#c1c7d0] bg-white text-[#172b4d] hover:bg-[#f4f5f7]",
        variant === "ghost" && "text-[#42526e] hover:bg-[#f4f5f7]",
        variant === "darkPrimary" && "bg-[#0c66e4] text-white hover:bg-[#0052cc]",
        variant === "darkSecondary" && "border border-[#5c606a] bg-[#303238] text-[#dfe1e6] hover:bg-[#3a3d43]",
        variant === "darkGhost" && "text-[#dfe1e6] hover:bg-[#3a3d43]",
        buttonProps.className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
