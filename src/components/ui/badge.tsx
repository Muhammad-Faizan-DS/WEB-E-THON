import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "flag" | "info";

const ICON: Record<BadgeTone, string> = {
  neutral: "[&_svg]:text-subtle-foreground",
  primary: "[&_svg]:text-primary",
  success: "[&_svg]:text-success",
  warning: "[&_svg]:text-warning-dot",
  danger: "[&_svg]:text-danger",
  flag: "[&_svg]:text-flag",
  info: "[&_svg]:text-info",
};
const DOT: Record<BadgeTone, string> = {
  neutral: "bg-subtle-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning-dot",
  danger: "bg-danger",
  flag: "bg-flag",
  info: "bg-info",
};

/** Outlined tag: counts and categories. Colour lives on the icon; text stays ink (danger excepted). */
export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[5px] border border-border bg-surface px-1.5 text-xs font-medium text-foreground [&_svg]:size-3.5",
        ICON[tone],
        tone === "danger" && "border-danger/30 bg-danger-soft text-danger",
        className,
      )}
      {...props}
    />
  );
}

/** Status: a dot and a word (DESIGN.md). */
/** Status is a dot plus a word. `pulse` is accepted for compatibility but no longer animates (no glow effects). */
export function Status({ tone = "neutral", children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string; pulse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium", tone === "danger" && "text-danger", className)}>
      <span className="relative flex size-2" aria-hidden>
        <span className={cn("relative inline-flex size-2 rounded-full", DOT[tone])} />
      </span>
      {children}
    </span>
  );
}
