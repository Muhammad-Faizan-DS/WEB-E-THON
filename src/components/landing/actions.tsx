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
export function NightActions({ className, where = "top" }: { className?: string; where?: "top" | "bottom" }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-7 gap-y-4", className)}>
      <Link
        href="/login"
        className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-emerald/90 px-6 font-display text-[15px] font-bold tracking-[-0.01em] text-[#04130d] ring-1 ring-inset ring-white/30 shadow-[inset_0_1px_0_rgb(255_255_255/0.55),inset_0_-2px_6px_rgb(0_0_0/0.15),0_14px_34px_-12px_rgb(16_185_129/0.75)] backdrop-blur-md transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-emerald-bright active:scale-[0.98]"
      >
        Sign in
        <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden />
      </Link>
      {SHOW_DEMO && (
        <nav aria-label={where === "top" ? "Try a demo account" : "Try a demo account (end of page)"} className="flex flex-wrap items-center gap-1 text-[14px] text-on-night-muted">
          <span className="mr-1.5">Try it as</span>
          {ROLES.map((r) => (
            <Link
              key={r.as}
              href={`/login?as=${r.as}`}
              className="inline-flex min-h-11 items-center rounded-full bg-white/[0.06] px-4 font-medium text-on-night ring-1 ring-inset ring-white/[0.14] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-md transition-[background-color,box-shadow] duration-150 hover:bg-white/[0.11] hover:ring-emerald/50"
            >
              {r.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
