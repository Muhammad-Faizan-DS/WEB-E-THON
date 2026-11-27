import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "border-info/30 bg-info-soft", icon: Info, iconCls: "text-info" },
  success: { cls: "border-success/30 bg-success-soft", icon: CheckCircle2, iconCls: "text-success" },
  warning: { cls: "border-warning/40 bg-warning-soft", icon: AlertTriangle, iconCls: "text-warning" },
  danger: { cls: "border-danger/30 bg-danger-soft", icon: XCircle, iconCls: "text-danger" },
};

export function Alert({
  tone = "info", title, children, className, action, role,
}: { tone?: keyof typeof tones; title?: React.ReactNode; children?: React.ReactNode; className?: string; action?: React.ReactNode; role?: string }) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cn("flex gap-3 rounded-lg border p-3.5 text-sm", t.cls, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-foreground/85")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
