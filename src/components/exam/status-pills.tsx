"use client";
import { CloudCheck, CloudOff, HardDrive, Loader2, ServerOff, Wifi, WifiOff, XCircle } from "lucide-react";
import type { Connection } from "@/lib/client/exam-engine";
import { cn, fmtTime } from "@/lib/utils";

/** One combined status: can the server hear me, and has it received my latest edit? (PRD §1 UX goal) */
export function SaveStatus({
  connection, pendingCount, rejectedCount, saving, lastAckAt, compact,
}: { connection: Connection; pendingCount: number; rejectedCount: number; saving: boolean; lastAckAt: string | null; compact?: boolean }) {
  let tone: "ok" | "busy" | "local" | "bad";
  let Icon = CloudCheck;
  let label: string;
  let detail: string | null = null;

  if (rejectedCount > 0) {
    tone = "bad"; Icon = XCircle; label = `${rejectedCount} change${rejectedCount > 1 ? "s" : ""} not accepted`;
  } else if (connection !== "online" && pendingCount > 0) {
    tone = "local"; Icon = HardDrive; label = "Saved on this device"; detail = `${pendingCount} waiting to send`;
  } else if (saving || pendingCount > 0) {
    tone = "busy"; Icon = Loader2; label = "Saving…";
  } else {
    tone = "ok"; Icon = CloudCheck; label = lastAckAt ? `All saved ${fmtTime(lastAckAt)}` : "All saved";
  }

  const ConnIcon = connection === "online" ? Wifi : connection === "offline" ? WifiOff : ServerOff;
  const connLabel = connection === "online" ? "Online" : connection === "offline" ? "Offline" : "Server unreachable";

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite" aria-atomic>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          connection === "online" ? "border-border text-muted-foreground" : "border-danger/40 bg-danger-soft text-danger",
          compact && connection === "online" && "hidden md:inline-flex",
        )}
        title={connLabel}
      >
        <ConnIcon className="size-3.5" aria-hidden />
        <span className={cn(compact && "sr-only md:not-sr-only")}>{connLabel}</span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          tone === "ok" && "border-success/30 bg-success-soft text-success",
          tone === "busy" && "border-border text-muted-foreground",
          tone === "local" && "border-warning/50 bg-warning-soft",
          tone === "bad" && "border-danger/40 bg-danger-soft text-danger",
        )}
      >
        <Icon className={cn("size-3.5", tone === "busy" && "animate-spin")} aria-hidden />
        <span className={cn(compact && "max-w-[9rem] truncate sm:max-w-none")}>{label}</span>
        {detail && <span className="hidden font-normal lg:inline">· {detail}</span>}
      </span>
    </div>
  );
}

export function OfflineBanner({ connection, pendingCount }: { connection: Connection; pendingCount: number }) {
  if (connection === "online") return null;
  return (
    <div role="alert" className="flex items-center gap-2 border-b border-warning/50 bg-warning-soft px-4 py-2 text-sm">
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <p>
        <b>{connection === "offline" ? "You're offline." : "Can't reach the exam server."}</b>{" "}
        Keep working. Your answers are saved on this device{pendingCount ? ` (${pendingCount} waiting)` : ""} and will be sent automatically.
        Only answers that reach the server before time runs out count.
      </p>
    </div>
  );
}
