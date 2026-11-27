"use client";
import { motion, useReducedMotion } from "motion/react";
import BlurText from "@/components/bits/BlurText";
import { Lede } from "./entry";

const RULES = ["Prevent what we control.", "Detect what we can observe.", "Reduce the payoff of what we can't."];
const LAST = "Never punish what we can't prove.";
const LINE = "font-display-tight text-[clamp(2.1rem,5.4vw,4.75rem)] font-extrabold text-rb-ink";

/** Entry 01: the four rules, written in one after another; the last is marked with a highlighter. */
export function Creed() {
  const reduce = useReducedMotion();
  return (
    <>
      <ol className="mt-12 space-y-3 md:mt-16">
        {RULES.map((r, i) => (
          <li key={r} className="relative">
            <span aria-hidden className="absolute top-[0.9em] -left-12 hidden font-mono text-[12px] text-rb-ink-2 md:block lg:-left-16">{i + 1}</span>
            <BlurText text={r} animateBy="words" delay={70} stepDuration={0.32} blur={8} distance={18} className={LINE} />
          </li>
        ))}
        <li className="relative pt-2">
          <span aria-hidden className="absolute top-[1.15em] -left-12 hidden font-mono text-[12px] text-rb-ink-2 md:block lg:-left-16">4</span>
          <motion.span
            className="inline bg-no-repeat [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
            style={{ backgroundImage: "linear-gradient(transparent 52%, var(--rb-canary) 52%, var(--rb-canary) 92%, transparent 92%)" }}
            initial={{ backgroundSize: "0% 100%" }}
            whileInView={{ backgroundSize: "100% 100%" }}
            viewport={{ once: true, amount: 0.8 }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.5, ease: [0.65, 0, 0.35, 1] }}
          >
            <span className={LINE}>{LAST}</span>
          </motion.span>
        </li>
      </ol>
      <Lede className="mt-12">
        Browser events can be missed or faked, so Fairmark treats them as hints for a person to read. Time, answer keys
        and grades are enforced on the server, whatever the browser does.
      </Lede>
    </>
  );
}
