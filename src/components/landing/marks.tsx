import { cn } from "@/lib/utils";

export type Severity = "info" | "review" | "priority";

const SEVERITY: Record<Severity, { label: string; dot: string }> = {
  info: { label: "Info", dot: "bg-rb-ink-2/60" },
  review: { label: "Review", dot: "bg-rb-amber" },
  priority: { label: "Priority review", dot: "bg-rb-rule" },
};

/** Status is a dot plus a word; the word stays ink. */
export function SeverityMark({ level, className }: { level: Severity; className?: string }) {
  const s = SEVERITY[level];
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[-0.005em]", className)}>
      <span aria-hidden className={cn("size-2.5 rounded-full ring-2 ring-black/5", s.dot)} />
      {s.label}
    </span>
  );
}

/** The Fairmark answer-box tick, used as a separator on the tape. */
export function TickBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("inline-block size-[0.7em] align-[-0.02em]", className)} aria-hidden>
      <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m5.6 10.4 2.9 2.9 5.9-6.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
