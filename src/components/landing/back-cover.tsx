import { CoverActions } from "./actions";

/** The back cover: the record closes with the same action it opened with. */
export function BackCover() {
  return (
    <section aria-labelledby="close-title" className="on-cover relative isolate overflow-hidden bg-rb-cover text-rb-cover-ink">
      <div aria-hidden className="cloth-grain pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_40px_rgb(0_0_0/0.7)]" />
      <div className="relative mx-auto max-w-[90rem] px-5 pt-28 pb-12 sm:px-8 md:pt-40">
        <h2 id="close-title" className="font-display-tight max-w-[12ch] text-[clamp(3rem,8.5vw,6rem)] font-black text-balance">
          Open the record.
        </h2>
        <p className="mt-6 max-w-[48ch] text-[17px] leading-[1.65] text-rb-cover-muted">
          Sign in to author an exam, sit one, or review what happened during one, with every decision written down.
        </p>
        <CoverActions className="mt-10" />

        <div className="mt-28 flex flex-col gap-4 border-t border-white/12 pt-6 text-[13px] text-rb-cover-muted md:flex-row md:items-center md:justify-between">
          <p>Fairmark · Technoverse 5.0 Web-e-Thon · COMSATS Lahore</p>
          <p>Integrity observations are hints for a person. They never change marks on their own.</p>
        </div>
      </div>
    </section>
  );
}
