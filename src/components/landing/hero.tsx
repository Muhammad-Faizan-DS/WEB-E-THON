import { HeroActions } from "./actions";
import { DotsBackground } from "./dots-bg";
import { ProductFrame } from "./product-frame";
import { HeroNotes } from "./hero-notes";
import { Workflow } from "./workflow";
import { WRAP } from "./section";

/**
 * Reading order in seconds: what it is (headline) → what to do (Sign in) beside a hands-on exam sheet → how it works (the journey) →
 * proof (the live monitor). Behind the top: the emerald 3D dot floor (Vanta).
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative pt-32 md:pt-44">
      <DotsBackground className="inset-x-0 top-0 bottom-auto h-[46rem] [mask-image:linear-gradient(to_bottom,transparent_8%,rgb(0_0_0/0.55)_34%,black_58%,black_72%,transparent_96%)]" />
      <div className={`relative z-10 ${WRAP}`}>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12">
          <div>
            <h1 id="hero-title" className="display max-w-[16ch] animate-[rise_0.8s_0.05s_cubic-bezier(0.22,1,0.36,1)_both] text-[clamp(2.4rem,5.4vw,4.25rem)] text-balance">
              Exams you can trust, even when <span className="text-primary">the Wi-Fi can&apos;t.</span>
            </h1>
            <HeroActions className="mt-9 animate-[rise_0.8s_0.2s_cubic-bezier(0.22,1,0.36,1)_both]" />
          </div>
          <HeroNotes className="hidden animate-[rise-far_1s_0.3s_cubic-bezier(0.22,1,0.36,1)_both] md:block" />
        </div>

        <div className="mt-24 border-t border-border pt-16 md:mt-28">
          <Workflow />
        </div>

        {/* glass needs something behind it: a soft emerald light and the dot field (siblings, no mask on the
            frame's ancestors, or the blur would have nothing to see) */}
        <div className="relative mt-16 md:mt-20">
          <div aria-hidden className="pointer-events-none absolute -inset-x-4 -inset-y-12 bg-[radial-gradient(40%_45%_at_30%_40%,color-mix(in_oklab,var(--primary)_26%,transparent),transparent_70%),radial-gradient(34%_40%_at_72%_62%,color-mix(in_oklab,#14b8a6_20%,transparent),transparent_70%)] md:-inset-x-10" />
          <DotsBackground className="-inset-x-4 -inset-y-12 z-0 [mask-image:radial-gradient(75%_70%_at_50%_45%,black,transparent)] md:-inset-x-10" />
          <div className="relative z-10">
            <ProductFrame />
          </div>
        </div>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">Sample data · what an examiner sees during an exam: who is working, who is offline, and what needs a decision.</p>
      </div>
    </section>
  );
}
