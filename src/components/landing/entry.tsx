import { cn } from "@/lib/utils";

/** Shared measure for the page: content sits right of the margin rule. */
export const PAGE_X = "mx-auto max-w-[90rem] px-5 sm:px-8";
export const MARGIN_COL = "md:grid-cols-[8.5rem_minmax(0,1fr)] lg:grid-cols-[10rem_minmax(0,1fr)]";

/**
 * One entry in the record: a timestamp and entry number in the margin, the heading and body to the right.
 * `data-entry` / `data-page` feed the running head in the nav.
 */
export function Entry({
  id,
  page,
  time,
  no,
  title,
  heading,
  children,
  className,
}: {
  id: string;
  page: string;
  time: string;
  no: string;
  title: string;
  heading?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} data-entry={title} data-page={page} aria-labelledby={`${id}-title`} className={cn("relative scroll-mt-16", className)}>
      <div className={PAGE_X}>
        <div className={cn("relative grid border-t border-rb-ink/15 py-20 md:py-32", MARGIN_COL)}>
          <p className="absolute top-5 right-0 font-mono text-[12px] text-rb-ink-2 tabular-nums md:hidden">
            {time} · p. {page}
          </p>
          <div aria-hidden className="hidden pt-2 pr-6 text-right md:block">
            <p className="font-mono text-[13px] text-rb-ink tabular-nums">{time}</p>
            <p className="mt-1 font-display text-[12px] font-bold text-rb-ink-2">Entry {no}</p>
          </div>
          <div className="min-w-0 md:pl-10 lg:pl-14">
            <h2
              id={`${id}-title`}
              className="font-display-tight max-w-[18ch] text-[clamp(2.1rem,4.4vw,3.75rem)] font-extrabold text-balance text-rb-ink"
            >
              {heading ?? title}
            </h2>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Body copy measure for entries. */
export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-6 max-w-[58ch] text-[17px] leading-[1.7] text-pretty text-rb-ink-2", className)}>{children}</p>;
}
