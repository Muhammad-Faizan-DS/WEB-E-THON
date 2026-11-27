import { HeroActions } from "./actions";
import { WRAP } from "./section";

/** Closing band: one heading, one line, the actions, between hairlines. Then the footer. */
export function Close() {
  return (
    <section id="get-started" aria-labelledby="close-title" className="border-t border-border pt-24 pb-12 md:pt-32">
      <div className={WRAP}>
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="close-title" className="display max-w-[18ch] text-[clamp(2rem,4vw,3.25rem)] text-balance">
              Run your next exam on Fairmark.
            </h2>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-muted-foreground">
              Author it, sit it, review what happened during it and publish results, with every decision written down.
            </p>
          </div>
          <HeroActions where="bottom" />
        </div>
        <footer className="mt-24 flex flex-col gap-3 border-t border-border pt-6 text-[13px] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>Fairmark · Technoverse 5.0 Web-e-Thon · COMSATS Lahore</p>
          <p>Integrity observations are hints for a person. They never change marks on their own.</p>
        </footer>
      </div>
    </section>
  );
}
