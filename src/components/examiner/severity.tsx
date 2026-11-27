import { AlertOctagon, AlertTriangle, ClipboardX, Info, Laptop, ScanFace, Wifi, EyeOff } from "lucide-react";
import type { ContactState, IncidentCategory, IncidentSeverity } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { cn, fmtAgo } from "@/lib/utils";

export const SEVERITY = {
  priority: { label: "Priority review", short: "Priority", tone: "danger" as const, icon: AlertOctagon, dot: "bg-danger" },
  review: { label: "Review", short: "Review", tone: "warning" as const, icon: AlertTriangle, dot: "bg-warning" },
  info: { label: "Info", short: "Info", tone: "info" as const, icon: Info, dot: "bg-info" },
};

export function SeverityBadge({ severity, short }: { severity: IncidentSeverity; short?: boolean }) {
  const s = SEVERITY[severity];
  return <Badge tone={s.tone}><s.icon aria-hidden />{short ? s.short : s.label}</Badge>;
}

export const CATEGORY: Record<IncidentCategory, { label: string; icon: typeof Wifi }> = {
  away: { label: "Away from exam", icon: EyeOff },
  paste: { label: "Clipboard", icon: ClipboardX },
  connectivity: { label: "Connection", icon: Wifi },
  session: { label: "Tabs & devices", icon: Laptop },
  camera: { label: "Camera check", icon: ScanFace },
};

export function IncidentCounts({ c }: { c: { info: number; review: number; priority: number } }) {
  if (!c.info && !c.review && !c.priority) return <span className="text-[13px] text-subtle-foreground">None</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {c.priority > 0 && <Badge tone="danger"><AlertOctagon aria-hidden />{c.priority}<span className="sr-only"> priority</span></Badge>}
      {c.review > 0 && <Badge tone="warning"><AlertTriangle aria-hidden />{c.review}<span className="sr-only"> review</span></Badge>}
      {c.info > 0 && <Badge tone="info"><Info aria-hidden />{c.info}<span className="sr-only"> info</span></Badge>}
    </span>
  );
}

export function ContactIndicator({ contact, lastAt, now }: { contact: ContactState; lastAt: string | null; now: number }) {
  if (contact === "none") return <span className="text-[13px] text-subtle-foreground">—</span>;
  const ago = lastAt ? fmtAgo(now - Date.parse(lastAt)) : "never";
  const cfg = {
    live: { dot: "bg-success", label: "Live", cls: "text-foreground" },
    stale: { dot: "bg-warning", label: "Quiet", cls: "text-foreground" },
    lost: { dot: "bg-danger", label: "No contact", cls: "font-medium text-danger" },
  }[contact];
  return (
    <span className={cn("num inline-flex items-center gap-2 text-[13px]", cfg.cls)}>
      <span className="relative flex size-2.5" aria-hidden>
        {contact === "live" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />}
        <span className={cn("relative inline-flex size-2.5 rounded-full", cfg.dot)} />
      </span>
      <span>{cfg.label} <span className="text-muted-foreground">· {ago}</span></span>
    </span>
  );
}

export function NotEvidenceNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-[13px] text-muted-foreground", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span><b className="font-semibold text-foreground">Observations are hints, not proof of misconduct.</b> They come from the candidate&apos;s browser and can be missed or delayed. Review the context and decide; nothing here changes marks.</span>
    </p>
  );
}
