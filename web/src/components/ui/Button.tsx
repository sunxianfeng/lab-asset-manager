"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:brightness-95 active:brightness-90",
  secondary:
    "bg-white/70 text-[var(--app-fg)] hover:bg-white/80 active:bg-white/70 border border-[var(--app-border)]",
  ghost:
    "bg-transparent text-[var(--app-fg)] hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-600",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-[15px]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold tracking-tight",
        "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "select-none",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}


