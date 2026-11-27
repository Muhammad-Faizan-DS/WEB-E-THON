import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-border bg-surface", icon: Info, iconCls: "text-info" },
  success: { cls: "border-border bg-surface", icon: CheckCircle2, iconCls: "text-success" },
  warning: { cls: "border-warning-dot/40 bg-warning-soft", icon: AlertTriangle, iconCls: "text-warning" },
  danger: { cls: "border-danger/30 bg-danger-soft", icon: XCircle, iconCls: "text-danger" },
};

/** Quiet note by default; tinted only for warnings and errors (DESIGN.md). */
export function Alert({
  tone = "info", title, children, className, action, role,
}: { tone?: keyof typeof tones; title?: React.ReactNode; children?: React.ReactNode; className?: string; action?: React.ReactNode; role?: string }) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-[13px]", t.cls, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-foreground/85")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Inline note without a box: icon + text on the paper. */
export function Note({ icon: Icon = Info, children, className }: { icon?: typeof Info; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-[13px] text-muted-foreground", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
