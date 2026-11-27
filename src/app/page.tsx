import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { body, display } from "@/components/landing/fonts";
import { RecordNav } from "@/components/landing/nav";
import { Cover } from "@/components/landing/cover";
import { Entry, Lede, PAGE_X } from "@/components/landing/entry";
import { Creed } from "@/components/landing/creed";
import { ClockDemo } from "@/components/landing/clock-demo";
import { ReceiptDemo } from "@/components/landing/receipt-demo";
import { Incidents } from "@/components/landing/incidents";
import { FeatureTape } from "@/components/landing/tape";
import { Journey } from "@/components/landing/journey";
import { VerifySlip } from "@/components/landing/verify-slip";
import { BackCover } from "@/components/landing/back-cover";

export const metadata: Metadata = {
  title: { absolute: "Fairmark · Exams that keep an honest record" },
  description:
    "Secure online exams where the server keeps the clock, every answer gets a receipt, and integrity observations are explained to a person instead of judged by a machine.",
};

const SPLIT = "mt-4 grid items-start gap-12 xl:grid-cols-[minmax(0,1fr)_30rem] xl:gap-14";

export default function Home() {
  return (
    <div className={cn(display.variable, body.variable, "record overflow-x-clip")}>
      <RecordNav />
      <main id="main">
        <Cover />

        {/* the pages: slide over the cover as you scroll */}
        <div className="grid-paper relative z-10 shadow-[0_-30px_60px_-12px_rgb(0_0_0/0.7)]">
          <div id="cover-end" aria-hidden className="absolute top-0 h-px w-full" />
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
            <div className={cn(PAGE_X, "h-full")}>
              <div className="h-full w-[8.5rem] border-r-[5px] border-double border-rb-rule/70 lg:w-[10rem]" />
            </div>
          </div>

          <Entry id="creed" page="02" time="09:58:10" no="01" title="The rules this record keeps">
            <Creed />
          </Entry>

          <Entry id="clock" page="03" time="10:02:31" no="02" title="The server keeps the clock.">
            <div className={SPLIT}>
              <div>
                <Lede>
                  Each attempt&apos;s deadline is worked out once, when it starts, and stored on the server. Refreshing,
                  reconnecting or changing the computer&apos;s clock never moves it. The timer you see is only a display
                  of the server&apos;s time.
                </Lede>
                <div className="mt-10 space-y-2 border-l-0 font-mono text-[14px] sm:text-[15px] xl:text-[14px] 2xl:text-[15px]">
                  <p>deadline = min(closes_at, started_at + duration)</p>
                  <p className="text-rb-ink-2">
                    <s className="ink-strike">deadline = device_time + duration</s>
                    <span className="sr-only"> (not how it works)</span>
                  </p>
                </div>
                <p className="mt-4 max-w-[52ch] text-[14px] text-rb-ink-2">
                  When an exam window closes before the full duration, the earlier time wins. Answers arriving more than
                  two seconds after the deadline are not accepted.
                </p>
              </div>
              <ClockDemo />
            </div>
          </Entry>

          <Entry id="receipts" page="04" time="10:06:47" no="03" title="Every answer gets a receipt.">
            <div className={SPLIT}>
              <div>
                <Lede>
                  Answers save as numbered revisions. The screen says &ldquo;Saved&rdquo; only when the server&apos;s receipt
                  matches your latest revision. If the connection drops, a copy is kept on your device and sent when
                  you&apos;re back. Nobody gets extra time for it.
                </Lede>
                <p className="mt-6 max-w-[52ch] text-[14px] text-rb-ink-2">
                  If the deadline passes while you are offline, the changes that never reached the server are listed on
                  your receipt as not accepted. A device timestamp can&apos;t prove when an edit was made.
                </p>
              </div>
              <ReceiptDemo />
            </div>
          </Entry>

          <Entry id="observations" page="05" time="10:12:40" no="04" title="Observations are explained, not judged.">
            <Lede>
              During an attempt Fairmark notes only what the candidate was told about at the start: leaving the page,
              exiting full screen, blocked pastes, dropped connections. It groups them into incidents with a plain
              explanation, and a person decides what, if anything, happens next.
            </Lede>
            <Incidents />
          </Entry>

          <FeatureTape />

          <Entry id="journey" page="06" time="10:31:05" no="05" title="The whole journey, in one record.">
            <Lede>
              From the first question written to a result someone else can check, every step happens in Fairmark and
              leaves its mark in the same record.
            </Lede>
            <Journey />
          </Entry>

          <Entry id="verify" page="07" time="10:44:02" no="06" title="Results anyone can verify.">
            <div className={SPLIT}>
              <Lede>
                Every published result PDF carries a random verification code and a QR code. Anyone holding the
                document can check it on Fairmark&apos;s public verify page, which shows masked details only.
              </Lede>
              <VerifySlip />
            </div>
          </Entry>
        </div>

        <BackCover />
      </main>
    </div>
  );
}
