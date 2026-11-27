"use client";
import * as React from "react";
import { fmtClock, fmtTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const DURATION = 20 * 60_000;
const STEP = 10 * 60_000;

/**
 * A sample attempt whose deadline is fixed at start. Moving the "device clock" changes only the
 * device clock; time left is measured on a monotonic clock, standing in for the server.
 */
export function ClockDemo() {
  const [base, setBase] = React.useState<{ wall: number; mono: number } | null>(null);
  const [mono, setMono] = React.useState(0);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const start = { wall: Date.now(), mono: performance.now() };
      setBase(start);
      setMono(start.mono);
    });
    const id = window.setInterval(() => setMono(performance.now()), 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, []);

  const elapsed = base ? (mono - base.mono) % DURATION : 0;
  const left = base ? DURATION - elapsed : DURATION;
  const deadline = base ? fmtTime(base.wall + DURATION) : "--:--:--";
  const device = base ? fmtTime(base.wall + (mono - base.mono) + offset) : "--:--:--";
  const minutes = Math.round(offset / 60_000);

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(11_15_13/0.04),0_24px_48px_-24px_rgb(11_15_13/0.18)] sm:p-7">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-[13px] font-bold">Sample attempt · 20 minutes</p>
        <p className="text-[12px] text-muted-foreground">Times in PKT</p>
      </div>

      <p className="mt-6 text-[13px] text-muted-foreground" id="left-label">Time left</p>
      <p aria-labelledby="left-label" className="font-display text-[clamp(3.5rem,9vw,5.5rem)] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
        {fmtClock(left)}
      </p>

      <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-border pt-4">
        <div>
          <dt className="text-[13px] text-muted-foreground">Deadline, set by the server</dt>
          <dd className="mt-0.5 font-mono text-[17px] tabular-nums">{deadline}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Your device clock</dt>
          <dd className="mt-0.5 font-mono text-[17px] tabular-nums">
            {device}
            {minutes !== 0 && (
              <span className="ml-2 align-middle font-display text-[12px] font-bold text-danger">
                {minutes > 0 ? "+" : "−"}
                {Math.abs(minutes)} min
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <ClockButton onClick={() => setOffset((o) => o + STEP)}>Move device clock +10 min</ClockButton>
        <ClockButton onClick={() => setOffset((o) => o - STEP)}>−10 min</ClockButton>
        <ClockButton onClick={() => setOffset(0)} disabled={offset === 0}>Reset</ClockButton>
      </div>
      <p aria-live="polite" className={cn("mt-4 min-h-[1.6em] text-[14px] font-medium transition-opacity duration-200", minutes === 0 ? "opacity-0" : "opacity-100")}>
        {minutes !== 0 && <>Your device clock moved {Math.abs(minutes)} min. The deadline and the time left did not.</>}
      </p>
    </div>
  );
}

function ClockButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex min-h-11 items-center rounded-full border border-border-strong bg-surface px-4 text-[14px] font-medium transition-[background-color,border-color] duration-150 hover:border-foreground/40 hover:bg-surface-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-45"
    />
  );
}
