import * as React from "react";
import { cn } from "@/lib/utils";

/** A sheet on the paper. Never nest one inside another; use a well (bg-surface-2) or a rule. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-surface", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-[15px] font-semibold leading-snug", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 border-t px-5 py-3", className)} {...props} />;
}

/** One bordered row of divided figures: the replacement for stat-card grids. */
export function StatStrip({ items, className }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string; onClick?: () => void; active?: boolean }[]; className?: string }) {
  // A plain strip is a description list; a clickable (filter) strip is a group of toggle buttons.
  const clickable = items.some((it) => it.onClick);
  const Wrap = clickable ? "div" : "dl";
  const Label = clickable ? "span" : "dt";
  const Value = clickable ? "span" : "dd";
  return (
    <Wrap className={cn("grid overflow-hidden rounded-lg border bg-surface", className)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${items.length > 4 ? 120 : 150}px, 1fr))` }}>
      {items.map((it) => {
        const inner = (
          <>
            <Label className="block text-[12px] text-muted-foreground">{it.label}</Label>
            <Value className={cn("mt-0.5 block font-display text-[22px] font-bold leading-tight tabular-nums", it.tone)}>{it.value}</Value>
            {it.hint && <Value className="mt-0.5 block text-[12px] text-muted-foreground">{it.hint}</Value>}
          </>
        );
        return it.onClick ? (
          <button key={it.label} type="button" onClick={it.onClick} aria-pressed={it.active}
            className={cn("-ml-px -mt-px min-h-11 border-l border-t px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2", it.active && "bg-primary-soft shadow-[inset_0_-2px_0_var(--primary)] hover:bg-primary-soft")}>
            {inner}
          </button>
        ) : (
          <div key={it.label} className="-ml-px -mt-px border-l border-t px-4 py-3">{inner}</div>
        );
      })}
    </Wrap>
  );
}
