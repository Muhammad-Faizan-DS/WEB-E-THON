"use client";
import { CloudOff } from "lucide-react";
import type { Connection } from "@/lib/client/exam-engine";
import { Status } from "@/components/ui/badge";
import { cn, fmtTime } from "@/lib/utils";

/** Answers "Has the server received my latest edit?" in one glance (PRD §1). */
export function SaveStatus({
  connection, pendingCount, rejectedCount, saving, lastAckAt, compact, deviceSaveFailed,
}: { connection: Connection; pendingCount: number; rejectedCount: number; saving: boolean; lastAckAt: string | null; compact?: boolean; deviceSaveFailed?: boolean }) {
  let tone: "success" | "neutral" | "warning" | "danger";
  let label: string;
  if (rejectedCount > 0) { tone = "danger"; label = `${rejectedCount} change${rejectedCount > 1 ? "s" : ""} not accepted`; }
  else if (connection !== "online" && pendingCount > 0 && deviceSaveFailed) { tone = "danger"; label = `Needs attention · ${pendingCount} not saved anywhere yet`; }
  else if (connection !== "online" && pendingCount > 0) { tone = "warning"; label = `Saved on this device · ${pendingCount} waiting`; }
  else if (saving || pendingCount > 0) { tone = "neutral"; label = "Saving…"; }
  else { tone = "success"; label = lastAckAt ? `Saved ${fmtTime(lastAckAt)}` : "All saved"; }

  return (
    <div className="flex items-center gap-4" role="status" aria-live="polite" aria-atomic>
      {connection !== "online" && (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <CloudOff className="size-4" aria-hidden />
          <span className={cn(compact && "sr-only md:not-sr-only")}>{connection === "offline" ? "Offline" : "Server unreachable"}</span>
        </span>
      )}
      <Status tone={tone} className={cn("num text-muted-foreground", tone === "danger" && "text-danger", tone === "warning" && "text-foreground", compact && "max-w-[10rem] truncate sm:max-w-none")}>
        {label}
      </Status>
    </div>
  );
}

export function OfflineBanner({ connection, pendingCount, deviceSaveFailed }: { connection: Connection; pendingCount: number; deviceSaveFailed?: boolean }) {
  if (connection === "online") return null;
  if (deviceSaveFailed) {
    return (
      <div role="alert" className="flex items-center gap-2.5 border-b border-danger/30 bg-danger-soft px-4 py-2 text-[13px]">
        <CloudOff className="size-4 shrink-0 text-danger" aria-hidden />
        <p>
          <b>{connection === "offline" ? "You're offline" : "Can't reach the exam server"}, and this browser won&apos;t let us keep a copy on the device.</b>{" "}
          Keep this tab open: your latest changes live only on this page until the connection returns. Don&apos;t refresh or close it.
        </p>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-center gap-2.5 border-b border-warning-dot/40 bg-warning-soft px-4 py-2 text-[13px]">
      <CloudOff className="size-4 shrink-0 text-warning" aria-hidden />
      <p>
        <b>{connection === "offline" ? "You're offline." : "Can't reach the exam server."}</b>{" "}
        Keep working. Answers are saved on this device{pendingCount ? ` (${pendingCount} waiting)` : ""} and sent automatically. Only answers that reach the server before time runs out count.
      </p>
    </div>
  );
}
