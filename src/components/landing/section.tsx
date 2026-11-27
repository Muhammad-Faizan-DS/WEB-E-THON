import { cn } from "@/lib/utils";

export const WRAP = "mx-auto max-w-[76rem] px-5 sm:px-8";

export function SectionTitle({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("display max-w-[20ch] text-[clamp(2rem,4vw,3.25rem)] font-semibold text-balance", className)}>
      {children}
    </h2>
  );
}

export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-5 max-w-[58ch] text-[17px] leading-[1.7] text-muted-foreground", className)}>{children}</p>;
}

/** A short fact line with an orange tick, used under ledes instead of feature cards. */
export function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.25rem_1fr] gap-3 py-3.5">
      <svg viewBox="0 0 20 20" aria-hidden className="mt-1 size-4 text-primary">
        <path d="m4.5 10.5 3.4 3.4 7.6-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-[15px] leading-[1.6] text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
