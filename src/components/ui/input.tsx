import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-surface px-3 text-sm shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-colors placeholder:text-subtle-foreground hover:border-foreground/30 focus-visible:border-primary disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-colors placeholder:text-subtle-foreground hover:border-foreground/30 focus-visible:border-primary disabled:opacity-60 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium leading-none", className)} {...props} />;
}
