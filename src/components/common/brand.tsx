import { cn } from "@/lib/utils";

/** Wordmark: an emerald answer box with a tick, beside the name set in Poppins. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-[16px] font-semibold tracking-[-0.025em]", className)}>
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" className="fill-brand" />
        <path d="m6.6 12.4 3.5 3.5 7.3-8.1" fill="none" className="stroke-brand-foreground" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fairmark
    </span>
  );
}
