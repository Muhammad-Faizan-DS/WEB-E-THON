import { cn } from "@/lib/utils";

/** Wordmark: an answer box with a tick, in ink blue, beside the name set in the UI face. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]", className)}>
      <svg viewBox="0 0 20 20" className="size-5 text-primary" aria-hidden>
        <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="m5.6 10.4 2.9 2.9 5.9-6.6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fairmark
    </span>
  );
}
