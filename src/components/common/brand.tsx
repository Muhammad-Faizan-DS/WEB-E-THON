import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="size-6 text-primary" aria-hidden>
        <rect x="3" y="2.5" width="15" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 8h7M7 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="17.5" cy="17" r="4.5" fill="var(--background)" stroke="currentColor" strokeWidth="1.8" />
        <path d="m15.6 17 1.3 1.3 2.4-2.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fairmark
    </span>
  );
}
