import { CoverActions } from "./actions";
import { EntrySlip } from "./entry-slip";
import { TopologyBackground } from "./topology-bg";

const LABEL_FIELDS = [
  ["Subject", "Online examinations"],
  ["Time kept by", "The server, not the device"],
  ["Reviewed by", "A person, never automatically"],
] as const;

/**
 * The cover: black bookcloth with Vanta topology lines, a pasted label carrying the headline, and the
 * sample record slip tucked under the elastic band. On tall wide screens it stays put while the first
 * page slides over it.
 */
export function Cover() {
  return (
    <section
      aria-labelledby="hero-title"
      className="on-cover relative isolate overflow-hidden bg-rb-cover text-rb-cover-ink [@media(min-width:1024px)_and_(min-height:760px)]:sticky [@media(min-width:1024px)_and_(min-height:760px)]:top-0 [@media(min-width:1024px)_and_(min-height:760px)]:h-[100svh]"
    >
      <TopologyBackground />
      <div aria-hidden className="cloth-grain pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_40px_rgb(0_0_0/0.7)]" />

      <div className="relative mx-auto grid h-full max-w-[90rem] items-center gap-14 px-5 pt-28 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-10 lg:pt-20 lg:pb-10 xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-16">
        <div className="min-w-0">
          {/* the label pasted on the cover */}
          <div className="grid-paper relative max-w-[47rem] rounded-[4px] p-2 text-rb-ink shadow-[0_1px_2px_rgb(0_0_0/0.4),0_30px_60px_-20px_rgb(0_0_0/0.75)]">
            <div className="rounded-[2px] border-[3px] border-double border-rb-ink/45 px-5 pt-7 pb-5 sm:px-9 sm:pt-10 sm:pb-7">
              <h1 id="hero-title" className="font-display-tight text-[clamp(2.3rem,6.2vw,5.6rem)] font-black lg:text-[clamp(2.3rem,5.3vw,5.6rem)] xl:text-[clamp(2.3rem,6vw,5.6rem)] text-balance">
                Every exam leaves an{" "}
                <span className="relative inline-block sm:whitespace-nowrap">
                  honest record.
                  <svg aria-hidden viewBox="0 0 400 18" preserveAspectRatio="none" className="absolute -bottom-[0.12em] left-0 h-[0.16em] w-full text-rb-ballpoint">
                    <path d="M3 12c70-7 160-10 250-8 50 1 98 3 144 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="animate-[draw_1.1s_0.5s_cubic-bezier(0.65,0,0.35,1)_both] [stroke-dasharray:420] [stroke-dashoffset:0]" />
                  </svg>
                </span>
              </h1>
              <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.65] text-pretty text-rb-ink-2 sm:text-[18px]">
                Fairmark runs secure online exams. The server keeps the clock, every answer gets a receipt, and integrity
                observations are explained to a person instead of judged by a machine.
              </p>
              <dl className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-3">
                {LABEL_FIELDS.map(([k, v]) => (
                  <div key={k} className="border-b border-rb-ink/35 pb-1.5">
                    <dt className="font-display text-[11px] font-bold tracking-[0.08em] text-rb-ink-2 uppercase">{k}</dt>
                    <dd className="mt-0.5 text-[15px] font-medium text-rb-ballpoint">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <CoverActions className="mt-10" />
        </div>

        {/* the slip, tucked under the elastic band */}
        <div className="relative mx-auto w-full max-w-[28rem] lg:mx-0">
          <div aria-hidden className="absolute -inset-y-[100vh] right-[22px] z-10 hidden w-[15px] bg-[linear-gradient(90deg,#050604,#1f231b_40%,#30362b_52%,#0b0c0a)] shadow-[3px_0_6px_rgb(0_0_0/0.55),-2px_0_4px_rgb(0_0_0/0.45)] lg:block" />
          <EntrySlip className="lg:-rotate-[2.2deg]" />
        </div>
      </div>
    </section>
  );
}
