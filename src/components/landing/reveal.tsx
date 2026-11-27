"use client";
import * as React from "react";
import { MotionConfig, motion } from "motion/react";

/** Scroll reveal: fades and lifts its content once as it enters the viewport. Reduced motion: fade only. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const C = motion[as];
  return (
    <MotionConfig reducedMotion="user">
      <C
        className={className}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </C>
    </MotionConfig>
  );
}
