"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[14px] px-4 text-[15px]",
        "bg-white/70 dark:bg-white/10",
        "border border-[var(--app-border)]",
        "placeholder:text-[var(--app-muted)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className,
      )}
      {...props}
    />
  );
}


