"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetTitle = D.Title;
export const SheetDescription = D.Description;

export function SheetContent({
  className, children, side = "right", ...props
}: React.ComponentProps<typeof D.Content> & { side?: "right" | "bottom" | "left" }) {
  const sides = {
    right: "inset-y-0 right-0 h-full w-[min(26rem,100%)] border-l",
    left: "inset-y-0 left-0 h-full w-[min(22rem,100%)] border-r",
    bottom: "inset-x-0 bottom-0 max-h-[80dvh] rounded-t-xl border-t",
  } as const;
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/30" />
      <D.Content className={cn("fixed z-50 flex flex-col overflow-y-auto bg-surface p-5 shadow-xl", sides[side], className)} {...props}>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
