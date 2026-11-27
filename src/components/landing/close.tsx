import { NightActions } from "./actions";
import { WRAP } from "./section";

/** Dark closing band: the same action the page opened with, then the footer. */
export function Close() {
  return (
    <section id="night-close" aria-labelledby="close-title" className="on-night relative isolate overflow-hidden bg-night text-on-night">
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(50%_80%_at_50%_100%,rgb(16_185_129/0.25),transparent_70%)]" />
      <div className={`relative ${WRAP} pt-28 pb-10 md:pt-40`}>
        <h2 id="close-title" className="display max-w-[16ch] text-[clamp(2.5rem,6.5vw,5rem)] font-extrabold text-balance">
          Run your next exam on Fairmark.
        </h2>
        <p className="mt-6 max-w-[50ch] text-[17px] leading-[1.65] text-on-night-muted">
          Author it, sit it, review what happened during it and publish results, with every decision written down.
        </p>
        <NightActions className="mt-10" where="bottom" />
        <div className="mt-28 flex flex-col gap-3 border-t border-night-line pt-6 text-[13px] text-on-night-muted md:flex-row md:items-center md:justify-between">
          <p>Fairmark · Technoverse 5.0 Web-e-Thon · COMSATS Lahore</p>
          <p>Integrity observations are hints for a person. They never change marks on their own.</p>
        </div>
      </div>
    </section>
  );
}
