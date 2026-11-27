"use client";
import DecryptedText from "@/components/bits/DecryptedText";

/** Entry 06: a result stub with its verification code. Sample data. */
export function VerifySlip() {
  return (
    <div className="relative max-w-[30rem] rounded-[3px] bg-[#f6f8f1] shadow-[0_2px_4px_rgb(0_0_0/0.12),0_20px_40px_-18px_rgb(0_0_0/0.35)]">
      {/* perforated tear line */}
      <div aria-hidden className="h-3 bg-[radial-gradient(circle_at_6px_0,var(--rb-page)_4px,transparent_4.5px)] bg-[length:12px_12px] bg-repeat-x" />
      <div className="px-6 pt-4 pb-6 sm:px-8">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-extrabold tracking-[-0.01em]">Statistics Quiz 1 · Result</p>
          <p className="text-[12px] text-rb-ink-2">Sample</p>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
          <div>
            <dt className="text-rb-ink-2">Candidate</dt>
            <dd className="mt-0.5 font-medium">S••• K•••</dd>
          </div>
          <div>
            <dt className="text-rb-ink-2">Score</dt>
            <dd className="mt-0.5 font-display text-[20px] font-extrabold tabular-nums">24 / 30</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-dashed border-rb-ink/30 pt-4">
          <p className="text-[13px] text-rb-ink-2">Verification code</p>
          <p className="mt-1 font-mono text-[clamp(1.4rem,3.4vw,1.9rem)] font-medium tracking-[0.04em] text-rb-ink">
            <DecryptedText text="FM-7K2Q-94XD" animateOn="view" sequential revealDirection="start" speed={45} characters="ABCDEFGHJKMNPQRSTUVWXYZ23456789" />
          </p>
        </div>
      </div>
    </div>
  );
}
