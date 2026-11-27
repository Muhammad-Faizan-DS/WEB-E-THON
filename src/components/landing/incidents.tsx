"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { SeverityMark, type Severity } from "./marks";

type Decision = "Dismissed" | "Follow up";
/** a block on the incident's mini timeline (percent of a 60 s window) or a point marker */
type Mark = { kind: "offline" | "hidden"; from: number; to: number; label: string } | { kind: "paste" | "sync"; at: number; label: string };
interface Incident { id: string; at: string; level: Severity; category: string; text: string; decidable: boolean; marks: Mark[] }

const INCIDENTS: Incident[] = [
  {
    id: "a",
    at: "10:12:40",
    level: "info",
    category: "Connectivity",
    text: "Offline 18 s. Two answers were kept on the device and synced when it came back.",
    decidable: false,
    marks: [{ kind: "offline", from: 18, to: 48, label: "Offline 18 s" }, { kind: "sync", at: 52, label: "2 answers synced" }],
  },
  {
    id: "b",
    at: "10:18:05",
    level: "review",
    category: "Away from the page",
    text: "Page hidden 12 s. No answers changed.",
    decidable: true,
    marks: [{ kind: "hidden", from: 30, to: 50, label: "Hidden 12 s" }],
  },
  {
    id: "c",
    at: "10:24:02",
    level: "priority",
    category: "Away, then a paste",
    text: "Hidden 45 s, then a 348-character paste was blocked. What happened while hidden is unknown.",
    decidable: true,
    marks: [{ kind: "hidden", from: 8, to: 83, label: "Hidden 45 s" }, { kind: "paste", at: 87, label: "Paste blocked" }],
  },
];

/** Things the integrity record never holds, each drawn as a crossed-out pictogram. */
const NEVER: { label: string; icon: React.ReactNode }[] = [
  { label: "Clipboard text", icon: <path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M9 3.5h6V6H9zM8.5 11h7M8.5 14.5h5" /> },
  { label: "Keystrokes", icon: <path d="M3.5 7h17a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9" /> },
  { label: "Screenshots", icon: <path d="M3 5.5h18v11H3zM8 20h8M12 16.5V20M7 3.5H5M3 8V6M17 3.5h2M21 8V6" /> },
  { label: "Camera images", icon: <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /> },
  { label: "Other tabs' addresses", icon: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l1.5 2h9.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5zM6.5 11h11M6.5 14.5h7" /> },
];

/** The incident drawn as a 60-second strip: shaded blocks for time offline/away, markers for events. */
function MiniTimeline({ marks, level }: { marks: Mark[]; level: Severity }) {
  return (
    <div aria-hidden className="relative mt-4 h-9 max-w-[38rem] rounded-md bg-surface-2 ring-1 ring-inset ring-border">
      {marks.map((m, i) =>
        "from" in m ? (
          <div
            key={i}
            className={cn(
              "absolute inset-y-1 grid place-items-center overflow-hidden rounded px-2 text-[11px] font-semibold whitespace-nowrap",
              m.kind === "offline" && "bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--muted-foreground)_35%,transparent)_0_3px,transparent_3px_7px)] text-foreground ring-1 ring-inset ring-muted-foreground/40",
              m.kind === "hidden" && level === "priority" && "bg-danger/20 text-foreground ring-1 ring-inset ring-danger/50",
              m.kind === "hidden" && level !== "priority" && "bg-warning-dot/25 text-foreground ring-1 ring-inset ring-warning-dot/60",
            )}
            style={{ left: `${m.from}%`, width: `${m.to - m.from}%` }}
          >
            {m.label}
          </div>
        ) : (
          <div key={i} className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5" style={{ left: `${m.at}%` }}>
            <span className={cn("grid size-5 shrink-0 -translate-x-1/2 place-items-center rounded-full text-[11px] font-bold text-white", m.kind === "paste" ? "bg-danger" : "bg-success")}>{m.kind === "paste" ? "!" : "✓"}</span>
            <span className="-ml-2 hidden text-[11px] font-medium whitespace-nowrap sm:inline">{m.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

/**
 * Entry 04: a sample incident timeline. Decisions are written in ballpoint; changing your mind strikes
 * the old decision through instead of erasing it.
 */
export function Incidents() {
  const [log, setLog] = React.useState<Record<string, { d: Decision; at: number }[]>>({});

  const decide = (id: string, d: Decision) =>
    setLog((l) => ({ ...l, [id]: [...(l[id] ?? []), { d, at: Date.now() }] }));

  return (
    <>
      <ol className="mt-12 border-t border-border">
        {INCIDENTS.map((inc) => {
          const history = log[inc.id] ?? [];
          const current = history.at(-1);
          return (
            <li key={inc.id} className="grid gap-x-8 gap-y-3 border-b border-border py-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-[13px] text-muted-foreground tabular-nums">{inc.at}</span>
                  <SeverityMark level={inc.level} />
                  <span className="text-[13px] text-muted-foreground">{inc.category}</span>
                </div>
                <MiniTimeline marks={inc.marks} level={inc.level} />
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.55] text-muted-foreground">{inc.text}</p>
              </div>
              <div className="lg:pt-0.5">
                {!inc.decidable ? (
                  <p className="text-[14px] text-muted-foreground">Info only. No decision needed.</p>
                ) : (
                  <div>
                    <div className="flex gap-2" role="group" aria-label={`Decision for the incident at ${inc.at}`}>
                      {(["Dismissed", "Follow up"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={current?.d === d}
                          onClick={() => decide(inc.id, d)}
                          className={cn(
                            "inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 text-[14px] font-medium transition-[background-color,border-color,color] duration-150 active:translate-y-px",
                            current?.d === d ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface hover:border-foreground/40 hover:bg-surface-2",
                          )}
                        >
                          {d === "Dismissed" ? "Dismiss" : "Follow up"}
                        </button>
                      ))}
                    </div>
                    <ul aria-live="polite" className="mt-2.5 space-y-0.5 text-[13px]">
                      {history.map((h, i) => (
                        <li key={h.at} className={cn(i < history.length - 1 ? "ink-strike text-muted-foreground" : "font-medium text-primary")}>
                          {h.d} by examiner · {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }).format(h.at)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-[14px] text-muted-foreground">Sample incidents with fictional data. A decision never changes marks, status or time.</p>

      <div className="mt-16 text-center">
        <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em]">What this record never contains</h3>
        <ul className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {NEVER.map((n) => (
            <li key={n.label} className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-3 py-5">
              <span aria-hidden className="relative grid size-14 place-items-center rounded-full border-2 border-dashed border-danger/45 text-muted-foreground">
                <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{n.icon}</svg>
                <span className="absolute top-1/2 left-1/2 h-[3px] w-[86%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-danger" />
              </span>
              <span className="text-[14px] leading-tight font-medium">{n.label}</span>
              <span className="sr-only"> (never collected)</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-muted-foreground">Only short facts are noted: when the page was hidden, for how long, and paste lengths. Never their content.</p>
      </div>
    </>
  );
}
