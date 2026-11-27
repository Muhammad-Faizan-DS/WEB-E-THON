"use client";
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { MotionConfig, motion, useInView, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export interface FlowNode {
  /** the stop's picture (a lucide icon), decorative */
  icon: React.ReactNode;
  /** one to three words */
  label: string;
  /** "brand" = the outcome to remember, "no" = what does NOT happen (slashed out) */
  tone?: "plain" | "brand" | "no";
}

/** One cycle of the travelling dot: it moves for the first 75%, then rests before the next trip. */
const CYCLE = 4.2;
const MOVE = 0.75;
const EASE = [0.22, 1, 0.36, 1] as const;
const MOVE_T = { duration: CYCLE, times: [0, MOVE, 1], ease: "linear" as const, repeat: Infinity };
const FADE_T = { duration: CYCLE, times: [0, 0.05, MOVE - 0.03, MOVE + 0.05, 1], repeat: Infinity };

/**
 * A picture-first workflow path, like a transit map: round stops with a pictogram and a few words,
 * joined by one line read left to right. As it scrolls into view the line fills, the stops pop in one
 * after another and a dot travels the route; the takeaway stop (filled emerald) pulses when the dot
 * reaches it, and the "never" stop gets slashed out. Reduced motion: the finished diagram, no movement.
 */
export function Flow({ nodes, label, className }: { nodes: FlowNode[]; label: string; className?: string }) {
  const ref = React.useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "center 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const n = nodes.length;
  const edge = `${50 / n}%`; // the line runs from the centre of the first stop to the centre of the last
  const brand = nodes.findIndex((x) => x.tone === "brand");
  const arrive = brand > 0 ? (MOVE * brand) / (n - 1) : -1;

  return (
    <MotionConfig reducedMotion="user">
      <figure className={cn("mt-8", className)}>
        <figcaption className="sr-only">{label}</figcaption>
        <ol ref={ref} className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {/* the route */}
          <div aria-hidden className="pointer-events-none absolute top-7 h-[2px] -translate-y-1/2 rounded-full bg-border sm:top-8 lg:top-9" style={{ left: edge, right: edge }}>
            <motion.div className="absolute inset-0 origin-left rounded-full bg-primary" style={{ scaleX: fill }} />
            <motion.span
              className="absolute top-1/2 -mt-[6px] -ml-[6px] size-3 rounded-full bg-primary ring-4 ring-background motion-reduce:hidden"
              initial={{ left: "0%", opacity: 0 }}
              animate={inView ? { left: ["0%", "100%", "100%"], opacity: [0, 1, 1, 0, 0] } : { opacity: 0 }}
              transition={inView ? { left: MOVE_T, opacity: FADE_T } : { duration: 0.2 }}
            />
          </div>
          {/* direction marks between stops */}
          {nodes.slice(0, -1).map((_, i) => (
            <span key={i} aria-hidden className="pointer-events-none absolute top-7 z-[5] grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background text-muted-foreground sm:top-8 lg:top-9" style={{ left: `${((i + 1) / n) * 100}%` }}>
              <ChevronRight className="size-3.5" />
            </span>
          ))}

          {nodes.map((x, i) => (
            <motion.li
              key={x.label}
              className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.15, ease: EASE }}
            >
              <span
                aria-hidden
                className={cn(
                  "relative grid size-14 place-items-center rounded-full border-2 sm:size-16 lg:size-[4.5rem] [&_svg]:size-7 sm:[&_svg]:size-8",
                  x.tone === "brand" && "border-primary bg-primary text-primary-foreground [--pg-accent:currentColor]",
                  x.tone === "no" && "border-dashed border-border-strong bg-background text-muted-foreground [--pg-accent:currentColor]",
                  (!x.tone || x.tone === "plain") && "border-border-strong bg-surface text-foreground [--pg-accent:var(--primary)]",
                )}
              >
                {x.icon}
                {x.tone === "brand" && arrive > 0 && (
                  <motion.span
                    className="pointer-events-none absolute -inset-2 rounded-full border-2 border-primary motion-reduce:hidden"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={inView ? { opacity: [0, 0, 0.9, 0, 0], scale: [0.85, 0.85, 1, 1.18, 1.18] } : { opacity: 0 }}
                    transition={inView ? { duration: CYCLE, times: [0, Math.max(0.01, arrive - 0.02), arrive + 0.02, Math.min(0.97, arrive + 0.2), 1], repeat: Infinity } : { duration: 0.2 }}
                  />
                )}
                {x.tone === "no" && (
                  <motion.span
                    className="absolute top-1/2 left-1/2 h-[2.5px] w-[84%] rounded-full bg-danger"
                    style={{ x: "-50%", y: "-50%", rotate: -45 }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.55 + i * 0.15, ease: EASE }}
                  />
                )}
              </span>
              <span className={cn("mt-3.5 text-[13px] leading-tight font-medium text-balance sm:text-[15px] lg:text-[16px]", x.tone === "no" && "text-muted-foreground line-through decoration-danger decoration-2", x.tone === "brand" && "font-semibold")}>
                {x.label}
              </span>
              {x.tone === "no" && <span className="sr-only"> (never happens)</span>}
            </motion.li>
          ))}
        </ol>
      </figure>
    </MotionConfig>
  );
}
