import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Lede, Point, SectionTitle, WRAP } from "@/components/landing/section";
import { ClockDemo } from "@/components/landing/clock-demo";
import { ReceiptDemo } from "@/components/landing/receipt-demo";
import { Incidents } from "@/components/landing/incidents";
import { Roles } from "@/components/landing/roles";
import { Features } from "@/components/landing/features";
import { VerifySlip } from "@/components/landing/verify-slip";
import { Close } from "@/components/landing/close";

export const metadata: Metadata = {
  title: { absolute: "Fairmark · Exams you can trust, even when the Wi-Fi can't" },
  description:
    "Secure online exams where the server keeps the clock, every answer gets a receipt, and integrity observations are explained to a person instead of judged by a machine.",
};

export default function Home() {
  return (
    <div className="overflow-x-clip bg-surface text-foreground">
      <SiteNav />
      <main id="main">
        <Hero />

        {/* light page starts under the product frame */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 bg-surface py-24 md:py-32">
          <div id="light-start" aria-hidden />
          <div className={WRAP}>
            <SectionTitle id="how-title">Two questions a candidate never has to ask.</SectionTitle>
            <Lede>
              &ldquo;How long do I have?&rdquo; and &ldquo;Is my latest answer saved?&rdquo; are answered on screen at all
              times, by the server, even when the connection drops.
            </Lede>

            <div className="mt-16 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20">
              <div>
                <h3 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] font-bold tracking-[-0.025em]">The server keeps the clock.</h3>
                <ul className="mt-4 divide-y divide-border">
                  <Point title="Set once, when the attempt starts">The deadline is the earlier of the window closing and start time plus duration, stored on the server.</Point>
                  <Point title="Nothing on the device can move it">Refreshing, reconnecting, switching devices or changing the computer&apos;s clock changes nothing.</Point>
                  <Point title="No accidental extra time">Answers arriving more than two seconds after the deadline are not accepted.</Point>
                </ul>
              </div>
              <ClockDemo />
            </div>

            <div className="mt-24 grid items-center gap-12 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-20">
              <div className="lg:order-2">
                <h3 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] font-bold tracking-[-0.025em]">Every answer gets a receipt.</h3>
                <ul className="mt-4 divide-y divide-border">
                  <Point title="Numbered revisions">&ldquo;Saved&rdquo; appears only when the server&apos;s receipt matches your latest revision.</Point>
                  <Point title="Kept on the device when offline">Work continues during an outage and is sent when the connection returns.</Point>
                  <Point title="Honest about the limits">Changes that never reached the server before the deadline are listed as not accepted.</Point>
                </ul>
              </div>
              <div className="lg:order-1"><ReceiptDemo /></div>
            </div>
          </div>
        </section>

        <section id="integrity" aria-labelledby="integrity-title" className="scroll-mt-16 border-y border-border bg-background py-24 md:py-32">
          <div className={WRAP}>
            <SectionTitle id="integrity-title">Observations are explained, not judged.</SectionTitle>
            <Lede>
              Fairmark notes only what the candidate was told about at the start: leaving the page, exiting full screen,
              blocked pastes, dropped connections. It groups them into incidents with a plain explanation, and a person
              decides what, if anything, happens next.
            </Lede>
            <Incidents />
          </div>
        </section>

        <section id="roles" aria-labelledby="roles-title" className="scroll-mt-16 bg-surface py-24 md:py-32">
          <div className={WRAP}>
            <SectionTitle id="roles-title">One platform, three roles.</SectionTitle>
            <Lede>Each role sees only what it needs. Every permission is checked on the server, not just hidden in the interface.</Lede>
            <Roles />
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-16 border-t border-border bg-background py-24 md:py-32">
          <div className={WRAP}>
            <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
              <div>
                <SectionTitle id="features-title">And the details that make it work.</SectionTitle>
                <Lede>
                  Every published result carries a random verification code and a QR code. Anyone holding the PDF can check
                  it on the public verify page, which shows masked details only.
                </Lede>
              </div>
              <VerifySlip />
            </div>
            <Features />
          </div>
        </section>

        <Close />
      </main>
    </div>
  );
}
