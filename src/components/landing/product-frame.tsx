"use client";
import * as React from "react";
import { Radio, Search } from "lucide-react";
import { AnswerStrip } from "@/components/ui/answer-strip";
import { cn } from "@/lib/utils";

type Tone = "live" | "done" | "locked" | "offline" | "priority";
interface Row { name: string; id: string; answered: number; kept?: number; tone: Tone; note: (t: number) => string }

const TOTAL = 10;
const ROWS: Row[] = [
  { name: "Ali Raza", id: "FA23-014", answered: 7, tone: "live", note: (t) => `Saved ${(t % 9) + 1} s ago` },
  { name: "Bilal Ahmed", id: "FA23-031", answered: 4, tone: "priority", note: () => "Away 45 s, then a paste" },
  { name: "Hina Malik", id: "FA23-022", answered: 3, kept: 3, tone: "offline", note: () => "3 answers kept on device" },
  { name: "Sara Khan", id: "FA23-019", answered: 10, tone: "done", note: () => "Submitted · receipt FM-2Q8K" },
  { name: "Omar Farooq", id: "FA23-027", answered: 5, tone: "locked", note: () => "Unlock request waiting" },
  { name: "Zara Shah", id: "FA23-040", answered: 8, tone: "live", note: (t) => `Saved ${((t + 4) % 7) + 1} s ago` },
];

const TONE: Record<Tone, { label: string; dot: string }> = {
  live: { label: "In progress", dot: "bg-brand" },
  done: { label: "Submitted", dot: "bg-info" },
  locked: { label: "Locked", dot: "bg-warning-dot" },
  offline: { label: "Offline", dot: "bg-muted-foreground" },
  priority: { label: "Priority review", dot: "bg-danger" },
};

const STATS = [
  ["Live", "21"],
  ["Needs review", "2"],
  ["Offline", "1"],
  ["Submitted", "3"],
  ["Not started", "1"],
] as const;

/** Glass inner surfaces, themed: translucent surface + hairline, no shadows. */
const CELL = "bg-surface/55 ring-1 ring-inset ring-foreground/[0.08]";
const BTN = "rounded-md px-3 py-1 text-[11px] font-semibold";

/**
 * A coded, non-interactive picture of the live monitor with sample data, set on frosted glass over the
 * hero's gradient plate. Screen readers get the one-line summary; the frame itself is decorative.
 */
export function ProductFrame({ className }: { className?: string }) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const climb = Math.floor(t / 12) % 3;

  return (
    <figure className={cn("relative", className)}>
      <figcaption className="sr-only">
        Sample of Fairmark&apos;s live monitor: 21 candidates in progress, 2 incidents to review, 1 candidate offline with answers kept on their device, 3 submitted.
      </figcaption>
      <div
        aria-hidden
        className="relative animate-[rise-far_1s_0.35s_cubic-bezier(0.22,1,0.36,1)_both] overflow-hidden rounded-[18px] border border-white/50 bg-surface/60 text-foreground backdrop-blur-2xl backdrop-saturate-150 select-none dark:border-white/10 dark:bg-surface/55"
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/25" />
        {/* top bar */}
        <div className="flex items-center gap-3 border-b border-foreground/[0.08] px-4 py-3 sm:px-5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground/20" />
            <span className="size-2.5 rounded-full bg-foreground/20" />
            <span className="size-2.5 rounded-full bg-foreground/20" />
          </span>
          <p className="ml-2 truncate text-[13px] font-semibold">Data Science Fundamentals · DSF-101</p>
          <span className={cn("ml-auto hidden items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-muted-foreground sm:inline-flex", CELL)}>
            <Radio className="size-3.5 text-primary" /> Live · updated {(t % 15) + 1} s ago
          </span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STATS.map(([k, v], i) => (
                <div key={k} className={cn("rounded-lg px-3 py-2.5", CELL, i > 2 && "hidden sm:block", i === 1 && "bg-danger-soft/70 ring-danger/25")}>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                  <p className={cn("text-[20px] font-bold tabular-nums", i === 1 && "text-danger")}>{v}</p>
                </div>
              ))}
            </div>
            <div className={cn("mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-muted-foreground", CELL)}>
              <Search className="size-3.5" /> Search by name or student ID
            </div>
            <ul className="mt-2 divide-y divide-foreground/[0.07]">
              {ROWS.map((r) => {
                const tone = TONE[r.tone];
                const answered = r.tone === "live" ? Math.min(TOTAL - 1, r.answered + climb) : r.answered;
                const shown = answered + (r.kept ?? 0);
                return (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-3 py-2.5 sm:grid-cols-[minmax(0,1.1fr)_9.5rem_minmax(0,1.3fr)] sm:gap-5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{r.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.id}</p>
                    </div>
                    <div className="hidden sm:block">
                      <AnswerStrip
                        total={TOTAL}
                        answered={answered}
                        kept={r.kept}
                        current={r.tone === "live" || r.tone === "priority" ? answered : undefined}
                        state={r.tone === "done" ? "done" : r.tone === "locked" ? "locked" : "live"}
                        label={`${r.name}: ${shown} of ${TOTAL} answered`}
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                        {shown} of {TOTAL}{r.kept ? <span className="font-medium text-foreground"> · {r.kept} waiting</span> : null}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[12px] font-medium">
                        <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
                        {tone.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{r.note(t)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hidden border-l border-foreground/[0.08] p-5 lg:block">
            <p className="text-[12px] font-semibold text-muted-foreground">Needs your attention</p>
            <div className="mt-3 rounded-xl bg-danger-soft/70 p-3.5 ring-1 ring-inset ring-danger/25">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold"><span className="size-2 rounded-full bg-danger" /> Priority review · Bilal Ahmed</p>
              <p className="mt-2 text-[12px] leading-[1.55]">
                The exam page was hidden for 45 s. Two seconds after returning to Question 3, a 348-character paste was blocked. What happened while the page was hidden is unknown.
              </p>
              <div className="mt-3 flex gap-2">
                <span className={cn(BTN, "bg-surface/70 ring-1 ring-inset ring-foreground/15")}>Dismiss</span>
                <span className={cn(BTN, "bg-brand text-brand-foreground")}>Follow up</span>
              </div>
            </div>
            <div className={cn("mt-3 rounded-xl p-3.5", CELL)}>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold"><span className="size-2 rounded-full bg-warning-dot" /> Unlock request · Omar Farooq</p>
              <p className="mt-2 text-[12px] leading-[1.55] text-muted-foreground">Opened on a 4th device after his laptop shut down. Clock kept running.</p>
              <div className="mt-3 flex gap-2">
                <span className={cn(BTN, "bg-surface/70 ring-1 ring-inset ring-foreground/15")}>Review</span>
              </div>
            </div>
            <p className="mt-5 text-[11px] text-muted-foreground">Sample data</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
