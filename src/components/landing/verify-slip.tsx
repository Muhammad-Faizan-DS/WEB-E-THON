"use client";
import DecryptedText from "@/components/bits/DecryptedText";

/** A result stub with its verification code. Sample data. */
export function VerifySlip() {
  return (
    <div className="relative w-full max-w-[30rem] rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(11_15_13/0.04),0_24px_48px_-24px_rgb(11_15_13/0.18)]">
      <div className="px-6 pt-5 pb-6 sm:px-8">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-extrabold tracking-[-0.01em]">Statistics Quiz 1 · Result</p>
          <p className="text-[12px] text-muted-foreground">Sample</p>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
          <div>
            <dt className="text-muted-foreground">Candidate</dt>
            <dd className="mt-0.5 font-medium">S••• K•••</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Score</dt>
            <dd className="mt-0.5 font-display text-[20px] font-extrabold tabular-nums">24 / 30</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-dashed border-border-strong pt-4">
          <p className="text-[13px] text-muted-foreground">Verification code</p>
          <p className="mt-1 font-mono text-[clamp(1.4rem,3.4vw,1.9rem)] font-medium tracking-[0.04em] text-foreground">
            <DecryptedText text="FM-7K2Q-94XD" animateOn="view" sequential revealDirection="start" speed={45} characters="ABCDEFGHJKMNPQRSTUVWXYZ23456789" />
          </p>
        </div>
      </div>
    </div>
  );
}
