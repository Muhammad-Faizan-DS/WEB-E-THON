"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeverityMark } from "./marks";
import { Signature } from "./signature";

const LINES = [
  { t: "10:24:02", text: "Exam page hidden" },
  { t: "10:24:47", text: "Page visible again, after 45 s" },
  { t: "10:24:49", text: "Paste of 348 characters, blocked by exam policy" },
];
const FINAL = LINES.length + 2; // lines, then the grouped incident, then the decision
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The slip tucked under the cover's band: three raw observations are written in, grouped into one
 * explained incident, and signed off by a person. Sample data, labelled as such.
 */
export function EntrySlip({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState(0);
  const [run, setRun] = React.useState(0);
  const shown = step;

  React.useEffect(() => {
    if (reduce) {
      // reduced motion: show the finished record at once (after hydration, so server and client agree)
      const raf = requestAnimationFrame(() => setStep(FINAL));
      return () => cancelAnimationFrame(raf);
    }
    const el = ref.current;
    if (!el) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const delays = [900, 1700, 2600, 3900, 5600];
        delays.forEach((d, i) => timers.push(window.setTimeout(() => setStep(i + 1), d)));
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [reduce, run]);

  const replay = () => {
    setStep(0);
    setRun((r) => r + 1);
  };

  return (
    <div ref={ref} className={cn("grid-paper relative w-full rounded-[3px] text-rb-ink shadow-[0_2px_3px_rgb(0_0_0/0.35),0_24px_48px_-12px_rgb(0_0_0/0.6)]", className)}>
      {/* the slip's own red margin rule */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[66px] w-[5px] border-x border-rb-rule/70" />
      <div className="relative py-4 pr-4 pl-[84px] lg:pr-[60px]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[13px] font-bold tracking-[-0.005em]">Attempt record · DSF-101 · Q3</p>
          <p className="shrink-0 font-mono text-[11px] text-rb-ink-2">p. 14</p>
        </div>
        <p className="mt-0.5 text-[12px] text-rb-ink-2">Sample record with fictional data</p>

        <ol aria-live="polite" className="mt-4 space-y-1.5">
          {LINES.map((l, i) => (
            <li key={l.t} className="relative min-h-[1.4em] text-[13.5px] leading-snug">
              {shown > i && (
                <>
                  <motion.span
                    className="absolute top-[0.25em] right-full mr-[20px] font-mono text-[10.5px] leading-none text-rb-ink-2 tabular-nums"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {l.t}
                  </motion.span>
                  <motion.span
                    className="block"
                    initial={{ clipPath: "inset(0 100% 0 0)" }}
                    animate={{ clipPath: "inset(0 0% 0 0)" }}
                    transition={{ duration: 0.7, ease: EASE }}
                  >
                    {l.text}
                  </motion.span>
                </>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-4 min-h-[9.5rem] border-t border-rb-ink/20 pt-3">
          <AnimatePresence initial={false}>
            {shown > LINES.length && (
              <motion.div
                key="incident"
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <SeverityMark level="priority" className="whitespace-nowrap" />
                  <span className="text-[12px] text-rb-ink-2">from 3 observations</span>
                </div>
                <p className="mt-2 text-[13.5px] leading-[1.55]">
                  The exam page was hidden for 45 s. Two seconds after returning to Question 3, a 348-character paste
                  was attempted and blocked by the exam policy. What happened while the page was hidden is unknown.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-2 flex min-h-12 items-end justify-between gap-3">
          <div className={cn("transition-opacity duration-300", shown >= FINAL ? "opacity-100" : "opacity-0")}>
            <p className="text-[12px] text-rb-ink-2">Examiner decision</p>
            <p className="font-display text-[14px] font-bold text-rb-ballpoint">Follow up with the candidate</p>
          </div>
          <Signature play={shown >= FINAL} className="-mb-1" />
        </div>
        <button
          type="button"
          onClick={replay}
          disabled={shown < FINAL}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-[4px] text-[12px] font-medium text-rb-ink-2 underline decoration-rb-ink-2/40 underline-offset-4 transition-opacity hover:text-rb-ink disabled:pointer-events-none disabled:opacity-0 motion-reduce:hidden"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Replay the record
        </button>
      </div>
    </div>
  );
}
