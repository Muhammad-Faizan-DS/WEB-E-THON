import { cn } from "@/lib/utils";

/** Drawn pictograms: roast/greige lines (currentColor) with vivid-orange fills. */
function BuildArt() {
  return (
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="20" y="10" width="56" height="76" rx="8" className="fill-surface" />
      <path d="M34 10v-2a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v2" />
      <rect x="30" y="26" width="10" height="10" rx="2.5" className="fill-brand stroke-brand" />
      <path d="m32.5 31 2.2 2.2 3.6-4.2" className="stroke-brand-foreground" strokeWidth="2" />
      <path d="M46 31h20" />
      <rect x="30" y="44" width="10" height="10" rx="2.5" />
      <path d="M46 49h16" />
      <rect x="30" y="62" width="10" height="10" rx="2.5" />
      <path d="M46 67h12" />
    </svg>
  );
}
function TakeArt() {
  return (
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="12" y="18" width="72" height="48" rx="6" className="fill-surface" />
      <path d="M6 74h84l-6 6H12z" className="fill-surface" />
      <circle cx="38" cy="42" r="13" />
      <path d="M38 34v8l5 4" />
      <path d="M58 36h16M58 44h12M58 52h8" />
      <circle cx="74" cy="64" r="11" className="fill-brand stroke-brand" />
      <path d="m69.5 64 3.2 3.2 5.8-6.4" className="stroke-brand-foreground" strokeWidth="2.4" />
    </svg>
  );
}
function ResultsArt() {
  return (
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 8h38l16 16v62a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" className="fill-surface" />
      <path d="M60 8v16h16" />
      <path d="M28 34h22M28 42h30" />
      <rect x="28" y="52" width="26" height="12" rx="3" className="fill-brand stroke-brand" />
      <path d="M33 58h16" className="stroke-brand-foreground" strokeWidth="2.4" />
      <rect x="58" y="62" width="12" height="12" rx="1.5" />
      <path d="M61 65h2v2h-2zM66 70h1M61 70h2" strokeWidth="2" />
      <path d="M28 74h18" />
    </svg>
  );
}

const STEPS = [
  { n: 1, title: "The examiner builds the exam", body: "Questions from a bank, a time window, rules. One click to publish.", Art: BuildArt },
  { n: 2, title: "Candidates take it, safely", body: "The server keeps the clock. Every answer is saved, even offline.", Art: TakeArt },
  { n: 3, title: "Everyone gets clear results", body: "Marked, explained, and verifiable with a code on the PDF.", Art: ResultsArt },
];

/** Arrow between steps; draws itself once (CSS only, collapses under reduced motion). */
function Connector({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 24" preserveAspectRatio="none" className={cn("h-6 w-full text-brand", className)} aria-hidden fill="none">
      <path d="M2 12h108" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 6" />
      <path d="m104 5 10 7-10 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * How Fairmark works, in three steps a visitor can read in seconds. A numbered flow with drawn
 * pictograms and arrows (a diagram, not a grid of feature cards).
 */
export function HowSteps() {
  return (
    <section id="how-it-works" aria-labelledby="steps-title" className="scroll-mt-20">
      <h2 id="steps-title" className="sr-only">How Fairmark works in three steps</h2>
      <ol className="grid items-start gap-y-4 md:grid-cols-[1fr_5rem_1fr_5rem_1fr] md:gap-y-0">
        {STEPS.map((s, i) => (
          <li key={s.n} className="contents">
            <div className="grid grid-cols-[4.5rem_1fr] items-start gap-4 md:block">
              <div className="relative size-[4.5rem] text-foreground md:size-24">
                <s.Art />
                <span className="absolute -top-1 -left-1 grid size-7 place-items-center rounded-md bg-foreground text-[13px] font-bold text-background">{s.n}</span>
              </div>
              <div className="md:mt-4">
                <h3 className="text-[19px] font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-1 max-w-[30ch] text-[15px] leading-[1.55] text-muted-foreground">{s.body}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <>
                <Connector className="mt-10 hidden md:block [&_path:first-child]:animate-[draw-line_0.8s_ease-out_both] [&_path:first-child]:[--len:120] [&_path:first-child]:[stroke-dashoffset:0]" />
                <div aria-hidden className="ml-[2.1rem] h-6 w-px border-l-2 border-dashed border-brand md:hidden" />
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
