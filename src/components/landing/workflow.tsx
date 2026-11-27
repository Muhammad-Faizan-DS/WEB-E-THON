"use client";
import * as React from "react";
import { CertificateQr, ClipboardMarks, IdTick, LaptopClock, PaperPencil, PlaneSend, ReceiptTick } from "./pictograms";
import { MotionConfig, motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: PaperPencil, title: "Build the paper", who: "Examiner" },
  { icon: PlaneSend, title: "Publish and enrol", who: "Examiner" },
  { icon: IdTick, title: "Verify identity", who: "Candidate" },
  { icon: LaptopClock, title: "Take the exam", who: "Candidate · server clock, saves offline" },
  { icon: ReceiptTick, title: "Submit, get a receipt", who: "Candidate" },
  { icon: ClipboardMarks, title: "Review and grade", who: "Examiner" },
  { icon: CertificateQr, title: "Results with proof", who: "Everyone · PDF with a verify code" },
] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The whole exam journey as one large top-to-bottom path. The line fills as you scroll and a dot rides
 * down with you; each stop lights up as it crosses the middle of the screen. Stops alternate sides on
 * wide screens and stack on phones. Reduced motion: the finished path, no movement.
 */
export function Workflow() {
  const ref = React.useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 65%", "end 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const dotTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <MotionConfig reducedMotion="user">
      <section id="how-it-works" aria-labelledby="flow-title" className="scroll-mt-20">
        <h2 id="flow-title" className="display mx-auto max-w-[22ch] text-center text-[clamp(1.9rem,3.6vw,3rem)] text-balance">How an exam runs, start to finish.</h2>
        <ol ref={ref} className="relative mt-14">
          {/* the path */}
          <div aria-hidden className="pointer-events-none absolute top-7 bottom-7 left-7 w-[2px] -translate-x-1/2 rounded-full bg-border md:left-1/2">
            <motion.div className="absolute inset-0 origin-top rounded-full bg-primary" style={{ scaleY: fill }} />
            <motion.span className="absolute left-1/2 -mt-2 -ml-2 size-4 rounded-full bg-primary ring-[6px] ring-background motion-reduce:hidden" style={{ top: dotTop }} />
          </div>
          {STEPS.map((s, i) => {
            const right = i % 2 === 1;
            return (
              <li key={s.title} className="relative grid grid-cols-[3.5rem_1fr] items-center gap-5 py-5 md:grid-cols-[1fr_3.5rem_1fr] md:gap-8">
                <motion.div
                  className={cn("col-start-2 md:row-start-1", right ? "md:col-start-3" : "md:col-start-1 md:text-right")}
                  initial={{ opacity: 0, x: right ? 24 : -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <p className="font-mono text-[12px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-[clamp(1.25rem,2.2vw,1.6rem)] font-semibold tracking-[-0.02em]">{s.title}</h3>
                  <p className="mt-1 text-[14px] text-muted-foreground">{s.who}</p>
                </motion.div>
                {/* the stop */}
                <div className="relative col-start-1 row-start-1 md:col-start-2">
                  <span aria-hidden className="relative grid size-14 place-items-center rounded-full border-2 border-border-strong bg-surface text-foreground [--pg-accent:var(--primary)] [&_svg]:size-7">
                    <s.icon />
                    <motion.span
                      className="absolute -inset-[2px] grid place-items-center rounded-full bg-primary text-primary-foreground [--pg-accent:currentColor] [&_svg]:size-7"
                      initial={{ opacity: 0, scale: 0.6 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-45% 0px -40% 0px" }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <s.icon />
                    </motion.span>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </MotionConfig>
  );
}
