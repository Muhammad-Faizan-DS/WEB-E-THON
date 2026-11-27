import { HeroActions } from "./actions";
import { DotsBackground } from "./dots-bg";
import { ProductFrame } from "./product-frame";
import { HowSteps } from "./steps";
import { WRAP } from "./section";

/**
 * Reading order in seconds: what it is (headline) → what to do (Sign in) → how it works (3 steps) →
 * proof (the live monitor, in a plain frame on a faint dot field).
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative pt-32 md:pt-44">
      <div className={WRAP}>
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
          <h1 id="hero-title" className="display max-w-[16ch] animate-[rise_0.8s_0.05s_cubic-bezier(0.22,1,0.36,1)_both] text-[clamp(2.4rem,5.4vw,4.25rem)] text-balance">
            Exams you can trust, even when the Wi-Fi can&apos;t.
          </h1>
          <div className="animate-[rise_0.8s_0.15s_cubic-bezier(0.22,1,0.36,1)_both] lg:pb-2">
            <p className="text-[16px] leading-[1.65] text-muted-foreground">
              Fairmark runs online exams where the server keeps the clock, every answer gets a receipt, and a person,
              not a machine, decides what an integrity observation means.
            </p>
          </div>
        </div>
        <HeroActions className="mt-9 animate-[rise_0.8s_0.25s_cubic-bezier(0.22,1,0.36,1)_both]" />

        <div className="mt-20 md:mt-24">
          <HowSteps />
        </div>

        <div className="relative mt-16 md:mt-20">
          <DotsBackground className="-inset-x-10 -inset-y-10 z-0 [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />
          <div className="relative z-10 [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
            <ProductFrame />
          </div>
        </div>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">Sample data · what an examiner sees during an exam: who is working, who is offline, and what needs a decision.</p>
      </div>
    </section>
  );
}
