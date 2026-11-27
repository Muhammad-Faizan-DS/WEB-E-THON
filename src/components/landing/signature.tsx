"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** A ballpoint sign-off: the stroke draws itself once when `play` turns true. */
export function Signature({ play, className }: { play: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const draw = { pathLength: play ? 1 : 0, opacity: play ? 1 : 0 };
  const t = (delay: number, duration: number) => (reduce ? { duration: 0 } : { delay, duration, ease: [0.65, 0, 0.35, 1] as const });
  return (
    <svg viewBox="0 0 168 44" className={cn("h-9 w-auto text-rb-ballpoint", className)} aria-hidden fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="M6 30c6-14 13-24 17-22 4 3-7 25-3 26 4 1 9-17 14-17 4 0-2 15 2 15 5 0 7-11 11-11 3 0 1 9 4 9 5 0 9-14 14-14 4 0 0 13 4 13 6 0 10-17 16-17 3 0 1 8 0 12"
        strokeWidth={2}
        initial={false}
        animate={draw}
        transition={t(0, 1.1)}
      />
      <motion.path
        d="M96 22c8-6 16-5 15 2-1 6-10 9-9 3 2-8 18-9 24-5 5 3 9 3 14 0"
        strokeWidth={2}
        initial={false}
        animate={draw}
        transition={t(0.9, 0.6)}
      />
      <motion.path d="M10 39c40-4 92-5 150-3" strokeWidth={1.4} initial={false} animate={draw} transition={t(1.4, 0.45)} />
    </svg>
  );
}
