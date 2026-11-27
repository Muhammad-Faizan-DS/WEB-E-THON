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

/** Primary action on a dark band: sign in, plus one-click demo roles when demo hints are on. */
export function NightActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-7 gap-y-4", className)}>
      <Link
        href="/login"
        className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-emerald px-6 font-display text-[15px] font-bold tracking-[-0.01em] text-[#04130d] shadow-[0_0_0_1px_rgb(16_185_129/0.4),0_12px_32px_-12px_rgb(16_185_129/0.7)] transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-emerald-bright active:scale-[0.98]"
      >
        Sign in
        <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden />
      </Link>
      {SHOW_DEMO && (
        <nav aria-label="Try a demo account" className="flex flex-wrap items-center gap-1 text-[14px] text-on-night-muted">
          <span className="mr-1.5">Try it as</span>
          {ROLES.map((r) => (
            <Link
              key={r.as}
              href={`/login?as=${r.as}`}
              className="inline-flex min-h-11 items-center rounded-full border border-night-line px-3.5 font-medium text-on-night transition-colors duration-150 hover:border-emerald/60 hover:bg-white/[0.04]"
            >
              {r.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
