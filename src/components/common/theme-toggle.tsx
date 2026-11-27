"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/**
 * Light/dark switch. Where the View Transitions API exists, the new theme grows out of the button as a
 * circle (about 500 ms); otherwise, or with reduced motion, it switches instantly. next-themes keeps the
 * saved choice.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const dark = mounted && resolvedTheme === "dark";

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = dark ? "light" : "dark";
    const doc = document as DocWithVT;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
    const apply = () => {
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      setTheme(next);
    };
    if (!doc.startViewTransition || reduce) { apply(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const t = doc.startViewTransition(apply);
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className={cn(
        "relative inline-grid size-10 place-items-center overflow-hidden rounded-lg border border-border-strong bg-surface text-foreground transition-colors duration-150 hover:bg-surface-2",
        className,
      )}
    >
      {/* sun */}
      <svg viewBox="0 0 24 24" aria-hidden className={cn("absolute size-[18px] transition-[transform,opacity] duration-300 ease-out", dark ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100")}>
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.6" x2="12" y2="4.8" transform={`rotate(${a} 12 12)`} />
          ))}
        </g>
      </svg>
      {/* moon */}
      <svg viewBox="0 0 24 24" aria-hidden className={cn("absolute size-[18px] transition-[transform,opacity] duration-300 ease-out", dark ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
        <path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z" fill="currentColor" />
      </svg>
    </button>
  );
}
