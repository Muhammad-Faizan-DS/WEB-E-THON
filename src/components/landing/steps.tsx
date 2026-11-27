import { ArrowRight } from "lucide-react";

/** Thin monochrome line art (currentColor); the only colour is a small emerald tick. */
function BuildArt() {
  return (
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="20" y="10" width="56" height="76" rx="7" />
      <path d="M36 10V7a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v3" />
      <rect x="30" y="26" width="10" height="10" rx="2.5" />
      <path d="m32.5 31 2.2 2.2 3.6-4.2" className="stroke-primary" strokeWidth="1.8" />
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
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="12" y="18" width="72" height="48" rx="5" />
      <path d="M6 74h84l-6 6H12z" />
      <circle cx="38" cy="42" r="13" />
      <path d="M38 34v8l5 4" />
      <path d="M58 36h16M58 44h12M58 52h8" />
      <circle cx="74" cy="64" r="10" className="fill-background" />
      <path d="m69.5 64 3.2 3.2 5.8-6.4" className="stroke-primary" strokeWidth="1.8" />
    </svg>
  );
}
function ResultsArt() {
  return (
    <svg viewBox="0 0 96 96" className="size-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 8h38l16 16v62a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" />
      <path d="M60 8v16h16" />
      <path d="M28 34h22M28 42h30" />
      <rect x="28" y="52" width="26" height="12" rx="3" />
      <path d="m35 58 3 3 6-6" className="stroke-primary" strokeWidth="1.8" />
      <rect x="58" y="62" width="12" height="12" rx="1.5" />
      <path d="M61 65h2v2h-2zM66 70h1M61 70h2" />
      <path d="M28 74h18" />
    </svg>
  );
}

const STEPS = [
  { n: "01", title: "The examiner builds the exam", body: "Questions from a bank, a time window, rules. One click to publish.", Art: BuildArt },
  { n: "02", title: "Candidates take it, safely", body: "The server keeps the clock. Every answer is saved, even offline.", Art: TakeArt },
  { n: "03", title: "Everyone gets clear results", body: "Marked, explained, and verifiable with a code on the PDF.", Art: ResultsArt },
];

/**
 * How Fairmark works, in three steps a visitor can read in seconds: three columns split by hairlines,
 * each with a numbered rule that points to the next step, a line drawing, and one sentence.
 */
export function HowSteps() {
  return (
    <section id="how-it-works" aria-labelledby="steps-title" className="scroll-mt-20">
      <h2 id="steps-title" className="sr-only">How Fairmark works in three steps</h2>
      <ol className="grid border-y border-border md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.n} className="grid grid-cols-[4.5rem_1fr] gap-5 border-b border-border py-7 last:border-b-0 md:block md:border-b-0 md:border-l md:px-8 md:py-9 md:first:border-l-0 md:first:pl-0">
            <div aria-hidden className="mb-7 hidden items-center gap-3 font-mono text-[12px] text-muted-foreground md:flex">
              <span>{s.n}</span>
              {i < STEPS.length - 1 ? (
                <>
                  <span className="h-px flex-1 bg-border-strong" />
                  <ArrowRight className="size-3.5" />
                </>
              ) : (
                <span className="h-px flex-1 bg-border" />
              )}
            </div>
            <div className="size-[4.5rem] text-foreground/70 md:size-20">
              <s.Art />
            </div>
            <div className="md:mt-6">
              <p aria-hidden className="mb-1 font-mono text-[12px] text-muted-foreground md:hidden">{s.n}</p>
              <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{s.title}</h3>
              <p className="mt-1.5 max-w-[32ch] text-[15px] leading-[1.6] text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
