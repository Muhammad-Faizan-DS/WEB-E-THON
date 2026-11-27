"use client";
import * as React from "react";
import { AlarmClock } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";

/** Server-time countdown. Quiet until 5 minutes, then warns; announces 5 and 1 minute politely. */
export function ExamTimer({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const min = remainingMs / 60000;
  const level = min <= 1 ? "danger" : min <= 5 ? "warning" : "normal";
  const [announce, setAnnounce] = React.useState("");
  const said = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (min <= 0) {
      if (!said.current.has("up")) { said.current.add("up"); setAnnounce("Time is up"); }
      return;
    }
    for (const [mark, text] of [[5, "5 minutes left"], [1, "1 minute left"]] as const) {
      if (min <= mark && min > mark - 0.1 && !said.current.has(text)) { said.current.add(text); setAnnounce(text); }
    }
  }, [min]);

  const pct = Math.max(0, Math.min(100, (remainingMs / Math.max(1, totalMs)) * 100));
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-md px-2.5 py-1 transition-colors",
        level === "warning" && "bg-warning-soft text-warning",
        level === "danger" && "bg-danger-soft text-danger",
      )}
    >
      {level !== "normal" && <AlarmClock className="size-4 shrink-0" aria-hidden />}
      <span className="sr-only">Time remaining: </span>
      <span role="timer" aria-live="off" className="num text-[22px] font-semibold leading-none tracking-[-0.01em]">{fmtClock(remainingMs)}</span>
      <span className="hidden text-[12px] font-medium text-muted-foreground sm:inline">{min <= 0 ? "time's up" : level === "danger" ? "last minute" : "left"}</span>
      <span className="absolute inset-x-2.5 -bottom-1 h-[2px] overflow-hidden rounded-full bg-border" aria-hidden>
        <span className={cn("block h-full w-full origin-left rounded-full transition-transform duration-1000 ease-linear", level === "normal" ? "bg-foreground/60" : "bg-current")} style={{ transform: `scaleX(${Math.max(0, Math.min(100, pct)) / 100})` }} />
      </span>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
}
