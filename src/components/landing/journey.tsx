const STEPS = [
  ["Author", "Examiner", "A question bank with single, multiple and written answers. CSV and JSON import with a dry run before anything is saved."],
  ["Publish", "Examiner", "A review-and-publish checklist, enrolment, and a sandbox preview that never counts toward results."],
  ["Take", "Candidate", "Server clock, autosave with receipts, a scratchpad, and text size, layout and theme preferences."],
  ["Submit", "Candidate", "A review screen, one final submission however many times it is pressed, and a receipt of what was accepted."],
  ["Grade", "Examiner", "Objective answers grade themselves from the snapshot the candidate saw. Written answers go to a grading queue."],
  ["Results", "Examiner, then candidate", "Results publish when the examiner says so. Question analytics flag a key that looks wrong."],
  ["Verify", "Anyone", "Each result PDF carries a verification code. Anyone can check it and sees masked details only."],
] as const;

/** Entry 05: a contents page with dotted leaders, one line per step, who does it on the right. */
export function Journey() {
  return (
    <>
      <ol className="mt-12 max-w-[60rem]">
        {STEPS.map(([step, who, detail], i) => (
          <li key={step} className="border-b border-rb-ink/15 py-5 first:border-t">
            <div className="flex items-baseline gap-4">
              <span className="w-6 shrink-0 font-mono text-[13px] text-rb-ink-2 tabular-nums">{i + 1}</span>
              <span className="font-display text-[clamp(1.4rem,2.8vw,2.1rem)] font-extrabold tracking-[-0.03em]">{step}</span>
              <span aria-hidden className="leader h-4 min-w-6 flex-1" />
              <span className="shrink-0 text-right text-[14px] font-medium text-rb-ink-2 sm:text-[15px]">{who}</span>
            </div>
            <p className="mt-1.5 max-w-[60ch] pl-10 text-[15px] leading-[1.6] text-rb-ink-2">{detail}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 max-w-[60ch] text-[15px] text-rb-ink-2">
        Administrators manage accounts and read the audit log. They never grade or take exams.
      </p>
    </>
  );
}
