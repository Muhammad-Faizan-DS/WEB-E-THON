import { NightActions } from "./actions";
import { DotsBackground } from "./dots-bg";
import { ProductFrame } from "./product-frame";

/** Dark hero: emerald dot field, headline, the primary action, and the live monitor straddling into the light page. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="on-night relative isolate bg-night text-on-night">
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <DotsBackground className="[mask-image:linear-gradient(to_bottom,transparent_8%,black_45%,black_80%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(55%_70%_at_50%_0%,rgb(16_185_129/0.28),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night" />
      </div>

      <div className="relative flow-root mx-auto max-w-[76rem] px-5 pt-36 sm:px-8 md:pt-44">
        <h1 id="hero-title" className="animate-[rise_0.8s_0.05s_cubic-bezier(0.22,1,0.36,1)_both] display max-w-[15ch] text-[clamp(2.75rem,7vw,5.75rem)] font-extrabold text-balance">
          Exams you can trust, even when the Wi-Fi can&apos;t.
        </h1>
        <p className="animate-[rise_0.8s_0.18s_cubic-bezier(0.22,1,0.36,1)_both] mt-7 max-w-[54ch] text-[17px] leading-[1.65] text-on-night-muted sm:text-[19px]">
          Fairmark keeps time on the server, gives every answer a receipt, and explains integrity observations to a
          person instead of judging them automatically.
        </p>
        <NightActions className="mt-10 animate-[rise_0.8s_0.3s_cubic-bezier(0.22,1,0.36,1)_both]" />

        <div className="relative z-10 mt-20 pb-24 md:mt-24 md:pb-32">
          <ProductFrame />
        </div>
      </div>
    </section>
  );
}
