"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { SeverityMark, type Severity } from "./marks";

type Decision = "Dismissed" | "Follow up";
interface Incident { id: string; at: string; level: Severity; category: string; text: string; decidable: boolean }

const INCIDENTS: Incident[] = [
  {
    id: "a",
    at: "10:12:40",
    level: "info",
    category: "Connectivity",
    text: "The connection dropped for 18 s. Two answers were kept on the device and accepted by the server when it came back.",
    decidable: false,
  },
  {
    id: "b",
    at: "10:18:05",
    level: "review",
    category: "Away from the page",
    text: "The exam page was hidden for 12 s, from 10:18:05 to 10:18:17. No answers changed in that time.",
    decidable: true,
  },
  {
    id: "c",
    at: "10:24:02",
    level: "priority",
    category: "Away, then a paste",
    text: "The exam page was hidden for 45 s. Two seconds after returning to Question 3, a 348-character paste was attempted and blocked by the exam policy. What happened while the page was hidden is unknown.",
    decidable: true,
  },
];

const NEVER = ["Clipboard text", "Keystrokes", "Screenshots", "Camera images", "Other tabs' addresses"];

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
                <p className="mt-2.5 max-w-[62ch] text-[16px] leading-[1.6]">{inc.text}</p>
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

      <div className="mt-16">
        <h3 className="font-display text-[20px] font-bold tracking-[-0.02em]">What this record never contains</h3>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          {NEVER.map((n) => (
            <li key={n} className="font-display text-[clamp(1.35rem,2.6vw,2rem)] font-bold tracking-[-0.02em] text-muted-foreground">
              <s className="ink-strike">{n}</s>
              <span className="sr-only"> (never collected)</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
