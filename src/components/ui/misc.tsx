"use client";
import * as React from "react";
import { Checkbox as CB, RadioGroup as RG, Switch as SW, Progress as PG, Separator as SP } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CB.Root>) {
  return (
    <CB.Root
      className={cn(
        "peer grid size-5 shrink-0 place-items-center rounded-[5px] border border-input bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CB.Indicator><Check className="size-3.5" strokeWidth={3} /></CB.Indicator>
    </CB.Root>
  );
}

export const RadioGroup = RG.Root;
export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RG.Item>) {
  return (
    <RG.Item
      className={cn("grid size-5 shrink-0 place-items-center rounded-full border border-input bg-surface data-[state=checked]:border-primary", className)}
      {...props}
    >
      <RG.Indicator className="size-2.5 rounded-full bg-primary" />
    </RG.Item>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SW.Root>) {
  return (
    <SW.Root
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors data-[state=checked]:bg-primary", className)}
      {...props}
    >
      <SW.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-5" />
    </SW.Root>
  );
}

export function Progress({ value, className, label }: { value: number; className?: string; label: string }) {
  return (
    <PG.Root value={value} aria-label={label} className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <PG.Indicator className="h-full rounded-full bg-foreground/80 transition-[width]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </PG.Root>
  );
}

export function Separator({ className, ...props }: React.ComponentProps<typeof SP.Root>) {
  return <SP.Root className={cn("shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">{children}</kbd>;
}
