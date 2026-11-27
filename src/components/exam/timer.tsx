"use client";
import * as React from "react";
import { AlarmClock, Hourglass } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";

/** Server-time countdown. Warnings at 5 and 1 minute are announced politely to screen readers. */
export function ExamTimer({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const min = remainingMs / 60000;
  const level = min <= 1 ? "danger" : min <= 5 ? "warning" : "normal";
  const [announce, setAnnounce] = React.useState("");
  const said = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    for (const [mark, text] of [[5, "5 minutes left"], [1, "1 minute left"]] as const) {
      if (min <= mark && min > mark - 0.1 && !said.current.has(text)) { said.current.add(text); setAnnounce(text); }
    }
  }, [min]);

  const pct = Math.max(0, Math.min(100, (remainingMs / Math.max(1, totalMs)) * 100));
  const Icon = level === "normal" ? Hourglass : AlarmClock;
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-1.5",
        level === "normal" && "border-border bg-surface",
        level === "warning" && "border-warning/50 bg-warning-soft",
        level === "danger" && "border-danger/50 bg-danger-soft text-danger",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <div className="leading-none">
        <span className="sr-only">Time remaining: </span>
        <span role="timer" aria-live="off" className="font-mono text-lg font-semibold tabular-nums sm:text-xl">{fmtClock(remainingMs)}</span>
        {level !== "normal" && <span className="ml-1.5 hidden text-xs font-medium sm:inline">{level === "danger" ? "Last minute" : "Under 5 min"}</span>}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-current/15" aria-hidden>
        <span className="block h-full bg-current/60 transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </span>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}
