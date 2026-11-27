"use client";
import * as React from "react";
import type { VantaEffect } from "vanta/dist/vanta.dots.min";
import { cn } from "@/lib/utils";

/**
 * Vanta DOTS: a perspective floor of emerald points, gently drifting, with mouse parallax.
 * Loads after first paint, only on wide screens without reduced motion; destroyed on unmount.
 * Without it the hero keeps its static glow.
 */
export function DotsBackground({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ok = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)").matches;
    if (!ok || document.documentElement.classList.contains("reduce-motion")) return;

    let effect: VantaEffect | null = null;
    let cancelled = false;
    const start = async () => {
      // vanta.dots reads window.THREE when its module loads, so three must be on window first
      const THREE = await import("three");
      (window as unknown as { THREE: unknown }).THREE = THREE;
      const { default: DOTS } = await import("vanta/dist/vanta.dots.min");
      if (cancelled || !ref.current) return;
      effect = DOTS({
        el: ref.current,
        THREE,
        mouseControls: true,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        color: 0x10b981,
        color2: 0x10b981,
        backgroundColor: 0x07090a,
        size: 2.4,
        spacing: 26,
        showLines: false,
      });
      setLive(true);
    };
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle ? window.requestIdleCallback(() => void start(), { timeout: 1200 }) : window.setTimeout(() => void start(), 300);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      effect?.destroy();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("absolute inset-0 transition-opacity duration-[1400ms] ease-out", live ? "opacity-100" : "opacity-0", className)}
    />
  );
}
