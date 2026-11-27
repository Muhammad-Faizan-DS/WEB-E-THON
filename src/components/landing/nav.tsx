"use client";
import * as React from "react";
import Link from "next/link";
import { Me } from "@/contracts";
import { api } from "@/lib/client/api";
import { ROLE_HOME } from "@/lib/client/me";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#integrity", label: "Integrity" },
  { href: "#roles", label: "Roles" },
  { href: "#features", label: "Features" },
];

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.03em]">
      <svg viewBox="0 0 24 24" className="size-[26px]" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" className="fill-brand" />
        <path d="m6.6 12.4 3.5 3.5 7.3-8.1" fill="none" className="stroke-brand-foreground" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fairmark
    </span>
  );
}

/** Transparent at the top, solid once you scroll. Theme toggle beside the main action. */
export function SiteNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [home, setHome] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    api.get("/api/auth/me", Me).then((m) => setHome(ROLE_HOME[m.role]), () => setHome(null));
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-200 ease-out", scrolled ? "border-border bg-background" : "border-transparent bg-transparent")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-foreground">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[76rem] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Fairmark home" className="shrink-0 rounded-md">
          <Wordmark />
        </Link>
        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center rounded-md px-3 text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href={home ?? "/login"} className="inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background transition-opacity duration-150 hover:opacity-85">
            {home ? "Open your dashboard" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
