import { HeroActions } from "./actions";
import { DotsBackground } from "./dots-bg";
import { ProductFrame } from "./product-frame";
import { HowSteps } from "./steps";
import { WRAP } from "./section";

/**
 * Reading order in seconds: what it is (headline) → what to do (Sign in) → how it works (3 steps) →
 * proof (the live monitor on a gradient plate).
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative pt-32 md:pt-40">
      <div className={WRAP}>
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
          <h1 id="hero-title" className="display max-w-[15ch] animate-[rise_0.8s_0.05s_cubic-bezier(0.22,1,0.36,1)_both] text-[clamp(2.6rem,6.4vw,5.25rem)] text-balance">
            Exams you can trust, even when the Wi-Fi can&apos;t.
          </h1>
          <div className="animate-[rise_0.8s_0.15s_cubic-bezier(0.22,1,0.36,1)_both] lg:pb-3">
            <p className="text-[17px] leading-[1.65] text-muted-foreground">
              Fairmark runs online exams where the server keeps the clock, every answer gets a receipt, and a person,
              not a machine, decides what an integrity observation means.
            </p>
          </div>
        </div>
        <HeroActions className="mt-9 animate-[rise_0.8s_0.25s_cubic-bezier(0.22,1,0.36,1)_both]" />

        <div className="mt-16 border-t border-border pt-10 md:mt-20">
          <HowSteps />
        </div>

        <div className="mesh-plate relative mt-16 overflow-hidden rounded-[28px] p-3 sm:p-6 md:mt-20 md:p-10">
          <DotsBackground className="z-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          <div className="relative z-10">
            <ProductFrame />
          </div>
        </div>
        <p className="mt-3 text-center text-[13px] text-muted-foreground">What an examiner sees during an exam: who is working, who is offline, and what needs a decision.</p>
      </div>
    </section>
  );
}
