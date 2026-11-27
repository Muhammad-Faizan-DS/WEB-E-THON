"use client";
import * as React from "react";
import Link from "next/link";
import { Me } from "@/contracts";
import { api } from "@/lib/client/api";
import { ROLE_HOME } from "@/lib/client/me";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#clock", label: "The clock" },
  { href: "#receipts", label: "Receipts" },
  { href: "#observations", label: "Observations" },
  { href: "#journey", label: "Journey" },
];

function Wordmark({ onCover }: { onCover: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-display text-[17px] font-extrabold tracking-[-0.03em]">
      <svg viewBox="0 0 20 20" className={cn("size-[22px] transition-colors duration-300", onCover ? "text-rb-canary" : "text-rb-ink")} aria-hidden>
        <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m5.6 10.4 2.9 2.9 5.9-6.6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fairmark
    </span>
  );
}

/**
 * Over the cover the bar is transparent and light. Once the first page has slid over the cover it
 * becomes the page's running head: title on the left, the current entry and page number on the right.
 */
export function RecordNav() {
  const [onCover, setOnCover] = React.useState(true);
  const [entry, setEntry] = React.useState<{ title: string; page: string } | null>(null);
  const [home, setHome] = React.useState<string | null>(null);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const sentinel = document.getElementById("cover-end");
    const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-entry]"));
    const coverIo = sentinel
      ? new IntersectionObserver(([e]) => setOnCover(e.boundingClientRect.top > 64), { rootMargin: "-64px 0px 0px 0px", threshold: [0, 1] })
      : null;
    if (sentinel) coverIo?.observe(sentinel);
    const pageIo = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) {
          const el = hit.target as HTMLElement;
          setEntry({ title: el.dataset.entry ?? "", page: el.dataset.page ?? "" });
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    pages.forEach((p) => pageIo.observe(p));
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    api.get("/api/auth/me", Me).then((m) => setHome(ROLE_HOME[m.role]), () => setHome(null));
    return () => {
      coverIo?.disconnect();
      pageIo.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,color,box-shadow] duration-300 ease-out",
        onCover ? cn("on-cover text-rb-cover-ink", scrolled && "border-b border-white/10 bg-rb-cover") : "border-b border-rb-ink/15 bg-rb-page text-rb-ink shadow-[0_1px_0_rgb(255_255_255/0.4)_inset]",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-rb-canary focus:px-3 focus:py-2 focus:text-rb-ink">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="Fairmark home" className="shrink-0 rounded-[4px]">
          <Wordmark onCover={onCover} />
        </Link>

        {onCover || !entry ? (
          <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[4px] px-3 text-[14px] font-medium transition-colors duration-150",
                  onCover ? "text-rb-cover-muted hover:text-rb-cover-ink" : "text-rb-ink-2 hover:text-rb-ink",
                )}
              >
                {l.label}
              </a>
            ))}
          </nav>
        ) : (
          <p className="ml-2 hidden min-w-0 items-baseline gap-3 truncate text-[14px] md:flex" aria-live="off">
            <span className="text-rb-ink-2">Record of Examination</span>
            <span aria-hidden className="text-rb-ink/30">/</span>
            <span className="truncate font-medium">{entry.title}</span>
          </p>
        )}

        <div className="ml-auto flex items-center gap-4">
          {!onCover && entry && <span className="hidden font-mono text-[12px] text-rb-ink-2 tabular-nums sm:inline">p. {entry.page}</span>}
          <Link
            href={home ?? "/login"}
            className={cn(
              "inline-flex h-10 items-center rounded-[6px] px-4 font-display text-[14px] font-bold tracking-[-0.01em] transition-colors duration-200",
              onCover ? "bg-rb-canary text-rb-ink hover:bg-rb-canary-2" : "bg-rb-ink text-rb-page hover:bg-rb-ink/85",
            )}
          >
            {home ? "Open your dashboard" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
