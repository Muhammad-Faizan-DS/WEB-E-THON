import { HeroActions } from "./actions";
import { WRAP } from "./section";

/** Closing band: text on a solid surface, the gradient plate beside it as the brand moment. Then the footer. */
export function Close() {
  return (
    <section id="get-started" aria-labelledby="close-title" className="py-20 md:py-28">
      <div className={WRAP}>
        <div className="grid overflow-hidden rounded-[28px] border border-border bg-surface lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="p-8 sm:p-12">
            <h2 id="close-title" className="display max-w-[16ch] text-[clamp(2.2rem,5vw,3.75rem)] text-balance">
              Run your next exam on Fairmark.
            </h2>
            <p className="mt-5 max-w-[48ch] text-[17px] leading-[1.65] text-muted-foreground">
              Author it, sit it, review what happened during it and publish results, with every decision written down.
            </p>
            <HeroActions className="mt-9" where="bottom" />
          </div>
          <div aria-hidden className="mesh-plate relative min-h-56 lg:min-h-full">
            <svg viewBox="0 0 120 120" className="absolute top-1/2 left-1/2 z-10 size-32 -translate-x-1/2 -translate-y-1/2 md:size-40">
              <rect x="8" y="8" width="104" height="104" rx="28" fill="none" className="stroke-brand-foreground/80 dark:stroke-greige/80" strokeWidth="6" />
              <path d="m34 62 17 17 36-40" fill="none" className="stroke-brand-foreground/80 dark:stroke-greige/80" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <footer className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-[13px] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>Fairmark · Technoverse 5.0 Web-e-Thon · COMSATS Lahore</p>
          <p>Integrity observations are hints for a person. They never change marks on their own.</p>
        </footer>
      </div>
    </section>
  );
}
