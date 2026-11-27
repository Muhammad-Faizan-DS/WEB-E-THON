"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import type { VantaEffect } from "vanta/dist/vanta.dots.min";
import { cn } from "@/lib/utils";

/**
 * Vanta DOTS on a transparent canvas: a perspective floor of points drifting over the gradient plate,
 * coloured for the current theme. Loads after first paint, only on wide screens without reduced motion;
 * rebuilt when the theme changes and destroyed on unmount.
 */
export function DotsBackground({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !resolvedTheme) return;
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
      const color = resolvedTheme === "dark" ? 0xffb07a : 0x3e2407;
      effect = DOTS({
        el: ref.current,
        THREE,
        mouseControls: true,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        color,
        color2: color,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        size: 2.2,
        spacing: 24,
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
  }, [resolvedTheme]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("absolute inset-0 transition-opacity duration-[1200ms] ease-out", live ? "opacity-60" : "opacity-0", className)}
    />
  );
}
