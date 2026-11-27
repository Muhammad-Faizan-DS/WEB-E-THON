"use client";
import * as React from "react";
import { Check, CloudOff, Timer } from "lucide-react";
import { MotionConfig, motion, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

const OPTIONS = ["0.25", "0.50", "0.75", "1.00"];
const SHADOW = "shadow-[0_28px_60px_-28px_rgb(0_0_0/0.45)] dark:shadow-[0_28px_60px_-24px_rgb(0_0_0/0.85)]";

/**
 * The hero's interactive 3D exam stack: a question sheet, a receipt slip and two status chips floating
 * at different depths. It tilts toward the pointer; choosing an answer on the sheet saves it ("Saving…" →
 * "Saved · rev n") and updates the receipt, which is the product in one gesture. Reduced motion: no
 * float or tilt, still clickable.
 */
export function HeroNotes({ className }: { className?: string }) {
  const rx = useMotionValue(10);
  const ry = useMotionValue(-16);
  const rotateX = useSpring(rx, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 120, damping: 18 });
  const [choice, setChoice] = React.useState(1);
  const [rev, setRev] = React.useState(7);
  const [saving, setSaving] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pick = (i: number) => {
    if (i === choice) return;
    setChoice(i);
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setSaving(false); setRev((r) => r + 1); }, 650);
  };

  return (
    <MotionConfig reducedMotion="user">
      <figure
        className={cn("relative h-[440px] w-full select-none [perspective:1300px]", className)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          ry.set(-16 + ((e.clientX - r.left) / r.width - 0.5) * 22);
          rx.set(10 - ((e.clientY - r.top) / r.height - 0.5) * 16);
        }}
        onPointerLeave={() => { rx.set(10); ry.set(-16); }}
      >
        <figcaption className="sr-only">A sample exam sheet. Choose an answer to see it saved with a new revision and a receipt.</figcaption>
        <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={{ rotateX, rotateY }}>
          {/* question sheet */}
          <motion.div
            className={cn("absolute top-6 left-[8%] w-[74%] rounded-xl border border-border bg-surface p-5 [transform-style:preserve-3d]", SHADOW)}
            style={{ z: 0 }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-mono">STAT-201</span>
              <span>Question 3 of 10 · 2 marks</span>
            </div>
            <p className="q-text mt-3 text-[15px] leading-snug">A fair coin is tossed twice. What is the probability of exactly one head?</p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Sample answers">
              {OPTIONS.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={choice === i}
                  onClick={() => pick(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors duration-150",
                    choice === i ? "border-primary/60 bg-primary-soft" : "border-border bg-background hover:border-border-strong",
                  )}
                >
                  <span className={cn("grid size-4 place-items-center rounded-full border", choice === i ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                    {choice === i && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="w-4 text-muted-foreground">{"ABCD"[i]}</span>
                  <span className="font-medium">{o}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-1" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < 2 ? "bg-foreground/75" : i === 2 ? "bg-primary" : "bg-foreground/10")} />
              ))}
            </div>
          </motion.div>

          {/* receipt slip */}
          <motion.div
            aria-hidden
            className={cn("absolute right-[2%] bottom-6 w-[44%] rounded-xl border border-border bg-surface p-4", SHADOW)}
            style={{ z: 70, rotate: 4 }}
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 6, delay: 0.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-[11px] text-muted-foreground">Receipt</p>
            <p className="mt-0.5 font-mono text-[17px] tracking-[0.06em]">FM-7K2Q</p>
            <p className="mt-2 flex items-center gap-1.5 text-[12px]"><Check className="size-3.5 text-success" aria-hidden /> Q3 saved · rev {rev}</p>
            <div className="mt-3 flex h-6 items-end gap-[2px]">
              {[3, 6, 2, 5, 6, 3, 4, 6, 2, 5, 3, 6, 4, 2, 6, 3, 5].map((h, i) => <span key={i} className="w-[3px] rounded-sm bg-foreground/70" style={{ height: `${h * 4}px` }} />)}
            </div>
          </motion.div>

          {/* timer chip */}
          <motion.div
            aria-hidden
            className={cn("absolute top-0 right-[6%] flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-[13px]", SHADOW)}
            style={{ z: 120 }}
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 5, delay: 0.3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Timer className="size-4 text-primary" /> <span className="num font-semibold">18:42</span> <span className="text-muted-foreground">left</span>
          </motion.div>

          {/* save status chip */}
          <motion.div
            aria-live="polite"
            className={cn("absolute bottom-24 left-0 flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-[13px]", SHADOW)}
            style={{ z: 100 }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 6.5, delay: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {saving ? (
              <><CloudOff className="size-4 text-muted-foreground" aria-hidden /> Saving on this device…</>
            ) : (
              <><span className="grid size-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" strokeWidth={3} aria-hidden /></span> Saved · rev {rev}</>
            )}
          </motion.div>
        </motion.div>
      </figure>
    </MotionConfig>
  );
}
