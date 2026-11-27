import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Same switch as the login page's demo list: mocks on, or NEXT_PUBLIC_DEMO_HINTS=1. */
export const SHOW_DEMO = process.env.NEXT_PUBLIC_USE_MOCKS === "1" || process.env.NEXT_PUBLIC_DEMO_HINTS === "1";

const ROLES = [
  { as: "candidate", label: "Candidate" },
  { as: "examiner", label: "Examiner" },
  { as: "admin", label: "Admin" },
] as const;

export function CanaryLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-12 items-center gap-2.5 rounded-[6px] bg-rb-canary px-6 font-display text-[15px] font-bold tracking-[-0.01em] text-rb-ink",
        "shadow-[0_1px_0_rgb(0_0_0/0.25),0_10px_24px_-10px_rgb(242_211_61/0.55)] transition-[background-color,transform] duration-200 ease-out",
        "hover:bg-rb-canary-2 active:translate-y-px",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Primary action on the dark cover: sign in, plus one-click demo roles when demo hints are on. */
export function CoverActions({ className }: { className?: string }) {
  return (
    <div className={cn("on-cover flex flex-wrap items-center gap-x-6 gap-y-4", className)}>
      <CanaryLink href="/login">Sign in</CanaryLink>
      {SHOW_DEMO && (
        <nav aria-label="Try a demo account" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[14px] text-rb-cover-muted">
          <span className="mr-2">Try it as</span>
          {ROLES.map((r, i) => (
            <span key={r.as} className="inline-flex items-center">
              <Link
                href={`/login?as=${r.as}`}
                className="inline-flex min-h-11 items-center rounded-[4px] px-1.5 font-medium text-rb-cover-ink underline decoration-rb-cover-muted/50 decoration-1 underline-offset-[6px] transition-colors duration-150 hover:decoration-rb-canary"
              >
                {r.label}
              </Link>
              {i < ROLES.length - 1 && <span aria-hidden className="px-0.5 text-rb-cover-muted/60">/</span>}
            </span>
          ))}
        </nav>
      )}
    </div>
  );
}
