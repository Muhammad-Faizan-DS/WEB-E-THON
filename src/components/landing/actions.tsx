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

/** The primary action (vivid orange, roast text) plus one-click demo roles when demo hints are on. */
export function HeroActions({ className, where = "top" }: { className?: string; where?: "top" | "bottom" }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-4", className)}>
      <Link
        href="/login"
        className="group inline-flex h-12 items-center gap-2.5 rounded-lg bg-brand px-6 text-[15px] font-semibold text-brand-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-brand-hover active:translate-y-px"
      >
        Sign in
        <ArrowRight className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden />
      </Link>
      {SHOW_DEMO && (
        <nav aria-label={where === "top" ? "Try a demo account" : "Try a demo account (end of page)"} className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          <span className="mr-1">Try it as</span>
          {ROLES.map((r) => (
            <Link
              key={r.as}
              href={`/login?as=${r.as}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-border-strong bg-surface px-4 font-medium text-foreground transition-colors duration-150 hover:border-foreground/40 hover:bg-surface-2"
            >
              {r.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
