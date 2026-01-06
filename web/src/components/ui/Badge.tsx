import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "blue" | "gray" | "green" | "red";

const toneClasses: Record<Tone, string> = {
  blue: "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]",
  gray: "bg-black/5 text-[var(--app-fg)] dark:bg-white/10",
  green: "bg-green-500/15 text-green-700 dark:text-green-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export function Badge({
  className,
  tone = "gray",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}


