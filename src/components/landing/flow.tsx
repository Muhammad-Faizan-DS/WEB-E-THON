"use client";
import * as React from "react";
import { MotionConfig, motion, useInView, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export interface FlowNode {
  /** a short drawn icon (lucide or inline svg), decorative */
  icon: React.ReactNode;
  label: string;
  sub?: string;
  /** "brand" = the outcome to remember, "no" = what does NOT happen (struck through) */
  tone?: "plain" | "brand" | "no";
}

/** One cycle of the travelling dot: it moves for the first 75%, then rests before the next trip. */
const CYCLE = 4.6;
const MOVE = 0.75;
const EASE = [0.22, 1, 0.36, 1] as const;
const MOVE_T = { duration: CYCLE, times: [0, MOVE, 1], ease: "linear" as const, repeat: Infinity };
const FADE_T = { duration: CYCLE, times: [0, 0.05, MOVE - 0.03, MOVE + 0.05, 1], repeat: Infinity };

/**
 * A workflow path that explains a mechanism before its demo. As it scrolls into view the path fills,
 * the steps appear one after another, and an emerald dot travels along it; the takeaway step lights up
 * when the dot arrives. Reads left to right on wide screens (top to bottom on phones, or always when
 * `vertical`). With reduced motion: no travelling dot, no movement, just the finished diagram.
 */
export function Flow({ nodes, label, className, vertical = false }: { nodes: FlowNode[]; label: string; className?: string; vertical?: boolean }) {
  const ref = React.useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { margin: "-12% 0px -12% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 92%", "center 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const n = nodes.length;
  const edge = `${50 / n}%`; // the path runs from the centre of the first step to the centre of the last
  const brand = nodes.findIndex((x) => x.tone === "brand");
  const arrive = brand > 0 ? (MOVE * brand) / (n - 1) : -1;

  const dot = (axis: "left" | "top") => (
    <motion.span
      className={cn("absolute size-2.5 rounded-full bg-primary motion-reduce:hidden", axis === "left" ? "top-1/2 -mt-[5px] -ml-[5px]" : "left-1/2 -ml-[5px] -mt-[5px]")}
      initial={{ [axis]: "0%", opacity: 0 }}
      animate={inView ? { [axis]: ["0%", "100%", "100%"], opacity: [0, 1, 1, 0, 0] } : { opacity: 0 }}
      transition={inView ? (axis === "left" ? { left: MOVE_T, opacity: FADE_T } : { top: MOVE_T, opacity: FADE_T }) : { duration: 0.2 }}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <figure className={cn("mt-6", className)}>
        <figcaption className="sr-only">{label}</figcaption>
        <ol ref={ref} className={cn("relative flex flex-col gap-3", !vertical && "sm:flex-row sm:items-stretch sm:gap-10")}>
          {/* horizontal path (wide screens) */}
          {!vertical && (
            <div aria-hidden className="pointer-events-none absolute top-1/2 hidden h-px bg-border-strong sm:block" style={{ left: edge, right: edge }}>
              <motion.div className="absolute inset-0 origin-left bg-primary/70" style={{ scaleX: fill }} />
              {dot("left")}
            </div>
          )}
          {/* vertical path (phones, or always when vertical) */}
          <div aria-hidden className={cn("pointer-events-none absolute left-[31px] w-px bg-border-strong", !vertical && "sm:hidden")} style={{ top: edge, bottom: edge }}>
            <motion.div className="absolute inset-0 origin-top bg-primary/70" style={{ scaleY: fill }} />
            {dot("top")}
          </div>

          {nodes.map((x, i) => (
            <motion.li
              key={x.label}
              className={cn("relative z-10 flex min-w-0", !vertical && "sm:flex-1", vertical && "max-w-[28rem]")}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.14, ease: EASE }}
            >
              <div
                className={cn(
                  "relative flex w-full min-w-0 items-center gap-3 rounded-lg border px-3.5 py-3",
                  x.tone === "brand" && "border-primary/45 bg-surface",
                  x.tone === "no" && "border-dashed border-border-strong bg-background text-muted-foreground",
                  (!x.tone || x.tone === "plain") && "border-border bg-surface",
                )}
              >
                {x.tone === "brand" && arrive > 0 && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute -inset-px rounded-lg ring-2 ring-primary motion-reduce:hidden"
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: [0, 0, 1, 0, 0] } : { opacity: 0 }}
                    transition={inView ? { duration: CYCLE, times: [0, Math.max(0.01, arrive - 0.03), arrive, Math.min(0.98, arrive + 0.16), 1], repeat: Infinity } : { duration: 0.2 }}
                  />
                )}
                <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg", x.tone === "brand" ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted-foreground", "[&_svg]:size-[18px]")}>
                  {x.icon}
                </span>
                <span className="min-w-0">
                  <span className="relative block w-fit text-[14px] leading-tight font-semibold">
                    {x.label}
                    {x.tone === "no" && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-x-0 top-1/2 h-[2px] origin-left bg-danger"
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.5 + i * 0.14, ease: EASE }}
                      />
                    )}
                  </span>
                  {x.tone === "no" && <span className="sr-only"> (does not happen)</span>}
                  {x.sub && <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{x.sub}</span>}
                </span>
              </div>
            </motion.li>
          ))}
        </ol>
      </figure>
    </MotionConfig>
  );
}
