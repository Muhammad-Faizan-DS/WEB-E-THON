"use client";
import * as React from "react";
import Link from "next/link";
import { Me } from "@/contracts";
import { api } from "@/lib/client/api";
import { ROLE_HOME } from "@/lib/client/me";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#integrity", label: "Integrity" },
  { href: "#roles", label: "Roles" },
  { href: "#features", label: "Features" },
];

function Wordmark({ night }: { night: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-display text-[17px] font-bold tracking-[-0.025em]">
      <svg viewBox="0 0 20 20" className={cn("size-[22px] transition-colors duration-300", night ? "text-emerald" : "text-primary")} aria-hidden>
        <rect x="1.5" y="1.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m5.6 10.4 2.9 2.9 5.9-6.6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fairmark
    </span>
  );
}

/** Transparent over the dark hero, solid dark once you scroll, white once the light page is under it. */
export function SiteNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [light, setLight] = React.useState(false);
  const [home, setHome] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const lightStart = document.getElementById("light-start");
      const darkEnd = document.getElementById("night-close");
      const y = 64;
      const pastHero = lightStart ? lightStart.getBoundingClientRect().top <= y : false;
      const inClose = darkEnd ? darkEnd.getBoundingClientRect().top <= y : false;
      setLight(pastHero && !inClose);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    api.get("/api/auth/me", Me).then((m) => setHome(ROLE_HOME[m.role]), () => setHome(null));
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const night = !light;
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,color] duration-300 ease-out",
        night ? "on-night text-on-night" : "text-foreground",
        night && !scrolled && "border-transparent bg-transparent",
        night && scrolled && "border-night-line bg-night",
        light && "border-border bg-surface",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-md focus:bg-emerald focus:px-3 focus:py-2 focus:text-[#04130d]">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[76rem] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Fairmark home" className="shrink-0 rounded-md">
          <Wordmark night={night} />
        </Link>
        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "inline-flex min-h-11 items-center rounded-md px-3 text-[14px] font-medium transition-colors duration-150",
                night ? "text-on-night-muted hover:text-on-night" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <Link
          href={home ?? "/login"}
          className={cn(
            "ml-auto inline-flex h-10 items-center rounded-full px-5 font-display text-[14px] font-bold tracking-[-0.01em] transition-colors duration-200",
            night ? "bg-white text-night hover:bg-white/85" : "bg-foreground text-surface hover:bg-foreground/85",
          )}
        >
          {home ? "Open your dashboard" : "Sign in"}
        </Link>
      </div>
    </header>
  );
}
