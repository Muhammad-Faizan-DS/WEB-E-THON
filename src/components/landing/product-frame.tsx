"use client";
import * as React from "react";
import { AlertTriangle, CloudOff, Lock, Radio, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "live" | "done" | "locked" | "offline" | "priority";
interface Row { name: string; id: string; q: number; tone: Tone; note: (t: number) => string }

const ROWS: Row[] = [
  { name: "Ali Raza", id: "FA23-014", q: 7, tone: "live", note: (t) => `Saved ${(t % 9) + 1} s ago` },
  { name: "Bilal Ahmed", id: "FA23-031", q: 4, tone: "priority", note: () => "Away 45 s, then a paste" },
  { name: "Hina Malik", id: "FA23-022", q: 6, tone: "offline", note: () => "3 answers kept on device" },
  { name: "Sara Khan", id: "FA23-019", q: 10, tone: "done", note: () => "Submitted · receipt FM-2Q8K" },
  { name: "Omar Farooq", id: "FA23-027", q: 5, tone: "locked", note: () => "Unlock request waiting" },
  { name: "Zara Shah", id: "FA23-040", q: 8, tone: "live", note: (t) => `Saved ${((t + 4) % 7) + 1} s ago` },
];

const TONE: Record<Tone, { label: string; dot: string; icon?: React.ElementType }> = {
  live: { label: "In progress", dot: "bg-emerald" },
  done: { label: "Submitted", dot: "bg-sky-400" },
  locked: { label: "Locked", dot: "bg-amber-400", icon: Lock },
  offline: { label: "Offline", dot: "bg-zinc-400", icon: CloudOff },
  priority: { label: "Priority review", dot: "bg-red-400", icon: AlertTriangle },
};

const STATS = [
  ["Live", "21"],
  ["Needs review", "2"],
  ["Offline", "1"],
  ["Submitted", "3"],
  ["Not started", "1"],
] as const;

/**
 * A coded, non-interactive picture of the live monitor with sample data. Screen readers get the
 * one-line summary; the frame itself is decorative.
 */
export function ProductFrame({ className }: { className?: string }) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <figure className={cn("relative", className)}>
      <figcaption className="sr-only">
        Sample of Fairmark&apos;s live monitor: 21 candidates in progress, 2 incidents to review, 1 candidate offline with answers kept on their device, 3 submitted.
      </figcaption>
      <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-10 h-40 bg-[radial-gradient(60%_100%_at_50%_100%,rgb(16_185_129/0.22),transparent)] blur-2xl" />
      <div aria-hidden className="relative overflow-hidden rounded-[14px] border border-white/[0.09] bg-night-2 text-on-night shadow-[0_40px_100px_-30px_rgb(0_0_0/0.85),0_0_0_1px_rgb(0_0_0/0.6)] select-none">
        {/* top bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </span>
          <p className="ml-2 truncate font-display text-[13px] font-semibold">Data Science Fundamentals · DSF-101</p>
          <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-on-night-muted sm:inline-flex">
            <Radio className="size-3.5 text-emerald" /> Live · updated {(t % 15) + 1} s ago
          </span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 p-4 sm:p-5">
            {/* stat strip */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.07] overflow-hidden rounded-lg border border-white/[0.07] sm:grid-cols-5">
              {STATS.map(([k, v], i) => (
                <div key={k} className={cn("px-3 py-2.5", i > 2 && "hidden sm:block", i === 1 && "bg-red-400/[0.06]")}>
                  <p className="text-[11px] text-on-night-muted">{k}</p>
                  <p className={cn("font-display text-[20px] font-bold tabular-nums", i === 1 && "text-red-300")}>{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] text-on-night-muted">
              <Search className="size-3.5" /> Search by name or student ID
            </div>

            <ul className="mt-2 divide-y divide-white/[0.06]">
              {ROWS.map((r) => {
                const tone = TONE[r.tone];
                const q = r.tone === "live" ? Math.min(10, r.q + Math.floor(t / 12) % 3) : r.q;
                return (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-center gap-3 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_7rem_minmax(0,1.3fr)]">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{r.name}</p>
                      <p className="font-mono text-[11px] text-on-night-muted">{r.id}</p>
                    </div>
                    <div className="hidden sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full w-full origin-left rounded-full bg-emerald/80 transition-transform duration-700 ease-out" style={{ transform: `scaleX(${q / 10})` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-on-night-muted tabular-nums">Q{q} of 10</p>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[12px] font-medium">
                        <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
                        {tone.label}
                      </p>
                      <p className="truncate text-[11px] text-on-night-muted">{r.note(t)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* attention rail */}
          <div className="hidden border-l border-white/[0.07] bg-white/[0.015] p-5 lg:block">
            <p className="text-[12px] font-semibold text-on-night-muted">Needs your attention</p>
            <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.05] p-3.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold"><span className="size-2 rounded-full bg-red-400" /> Priority review · Bilal Ahmed</p>
              <p className="mt-2 text-[12px] leading-[1.55] text-on-night/85">
                The exam page was hidden for 45 s. Two seconds after returning to Question 3, a 348-character paste was blocked. What happened while the page was hidden is unknown.
              </p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-md border border-white/10 px-2.5 py-1 text-[11px]">Dismiss</span>
                <span className="rounded-md bg-emerald px-2.5 py-1 text-[11px] font-semibold text-[#04130d]">Follow up</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-white/[0.07] p-3.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold"><span className="size-2 rounded-full bg-amber-400" /> Unlock request · Omar Farooq</p>
              <p className="mt-2 text-[12px] leading-[1.55] text-on-night-muted">Opened on a 4th device after his laptop shut down. Clock kept running.</p>
            </div>
            <p className="mt-5 text-[11px] text-on-night-muted">Sample data</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
