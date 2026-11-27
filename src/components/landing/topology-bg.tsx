"use client";
import * as React from "react";
import type { VantaEffect } from "vanta/dist/vanta.topology.min";
import { cn } from "@/lib/utils";

/**
 * Vanta TOPOLOGY (p5 flow field) drawn as faint graphite lines on the bookcloth.
 * Loads after first paint, only on wide screens without reduced motion, pauses off-screen,
 * and stops drawing after a while so the pattern settles instead of saturating.
 */
export function TopologyBackground({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ok = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)").matches;
    if (!ok || document.documentElement.classList.contains("reduce-motion")) return;

    let effect: VantaEffect | null = null;
    let cancelled = false;
    let settled = false;
    let visible = true;

    const settleTimer = window.setTimeout(() => {
      settled = true;
      effect?.p5?.noLoop();
    }, 40_000);

    const start = async () => {
      const [{ default: p5 }, { default: TOPOLOGY }] = await Promise.all([
        import("p5"),
        import("vanta/dist/vanta.topology.min"),
      ]);
      if (cancelled || !ref.current) return;
      effect = TOPOLOGY({
        el: ref.current,
        p5,
        color: 0xb4c4a3,
        backgroundColor: 0x0f110e,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
      });
      if (!visible) effect.p5?.noLoop();
      setLive(true);
    };

    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(() => void start(), { timeout: 1200 })
      : window.setTimeout(() => void start(), 300);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      const p = effect?.p5;
      if (!p) return;
      if (visible && !settled) p.loop();
      else p.noLoop();
    });
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      window.clearTimeout(settleTimer);
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      effect?.destroy();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden transition-opacity duration-[1600ms] ease-out", live ? "opacity-100" : "opacity-0", className)}
    />
  );
}
