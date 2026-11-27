import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 text-foreground",
        primary: "border-primary/30 bg-primary-soft text-primary",
        success: "border-success/30 bg-success-soft text-success",
        warning: "border-warning/40 bg-warning-soft text-[color-mix(in_oklch,var(--warning)_70%,var(--foreground))]",
        danger: "border-danger/30 bg-danger-soft text-danger",
        flag: "border-flag/30 bg-flag-soft text-flag",
        info: "border-info/30 bg-info-soft text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
