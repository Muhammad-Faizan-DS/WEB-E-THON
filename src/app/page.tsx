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
import { Flow } from "@/components/landing/flow";
import { Reveal } from "@/components/landing/reveal";
import { Ban, Clock3, CloudOff, Eye, FileText, HardDrive, MonitorSmartphone, PenLine, Server, UserCheck } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Fairmark · Exams you can trust, even when the Wi-Fi can't" },
  description:
    "Secure online exams where the server keeps the clock, every answer gets a receipt, and integrity observations are explained to a person instead of judged by a machine.",
};

export default function Home() {
  return (
    <div className="overflow-x-clip bg-background text-foreground">
      <SiteNav />
      <main id="main">
        <Hero />

        <section id="how" aria-labelledby="how-title" className="mt-20 scroll-mt-16 border-t border-border py-24 md:mt-24 md:py-32">
          <div className={WRAP}>
            <Reveal>
              <SectionTitle id="how-title">Two questions a candidate never has to ask.</SectionTitle>
              <Lede>
                &ldquo;How long do I have?&rdquo; and &ldquo;Is my latest answer saved?&rdquo; are answered on screen at all
                times, by the server, even when the connection drops.
              </Lede>
            </Reveal>

            <div className="mt-16 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20">
              <div>
                <h3 className="text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-[-0.025em]">How long do I have?</h3>
                <p className="mt-1 text-[16px] text-muted-foreground">The server keeps the clock, not the device.</p>
                <Flow
                  vertical
                  label="Time: the server sets the deadline once; the device clock cannot change it."
                  nodes={[
                    { icon: <Server />, label: "Server clock starts", sub: "the moment you press Start" },
                    { icon: <Clock3 />, label: "Deadline fixed once", sub: "start + duration, never past closing", tone: "brand" },
                    { icon: <MonitorSmartphone />, label: "Device clock", sub: "refresh, new tab or clock change: no effect", tone: "no" },
                  ]}
                />
                <ul className="mt-4 divide-y divide-border">
                  <Point title="Set once, when the attempt starts">The deadline is the earlier of the window closing and start time plus duration, stored on the server.</Point>
                  <Point title="Nothing on the device can move it">Refreshing, reconnecting, switching devices or changing the computer&apos;s clock changes nothing.</Point>
                  <Point title="No accidental extra time">Answers arriving more than two seconds after the deadline are not accepted.</Point>
                </ul>
              </div>
              <Reveal delay={0.1}><ClockDemo /></Reveal>
            </div>

            <div className="mt-24 grid items-center gap-12 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-20">
              <div className="lg:order-2">
                <h3 className="text-[clamp(1.5rem,2.4vw,2rem)] font-semibold tracking-[-0.025em]">Is my answer saved?</h3>
                <p className="mt-1 text-[16px] text-muted-foreground">Every answer gets a receipt, even offline.</p>
                <Flow
                  vertical
                  label="Saving: an answer is saved with a receipt; offline it is kept on the device and sent later."
                  nodes={[
                    { icon: <PenLine />, label: "You answer", sub: "each edit gets a revision number" },
                    { icon: <CloudOff />, label: "Connection drops?", sub: "kept on this device, sent on reconnect" },
                    { icon: <HardDrive />, label: "Server receipt", sub: "“Saved” only when it matches your latest edit", tone: "brand" },
                  ]}
                />
                <ul className="mt-4 divide-y divide-border">
                  <Point title="Numbered revisions">&ldquo;Saved&rdquo; appears only when the server&apos;s receipt matches your latest revision.</Point>
                  <Point title="Kept on the device when offline">Work continues during an outage and is sent when the connection returns.</Point>
                  <Point title="Honest about the limits">Changes that never reached the server before the deadline are listed as not accepted.</Point>
                </ul>
              </div>
              <Reveal className="lg:order-1" delay={0.1}><ReceiptDemo /></Reveal>
            </div>
          </div>
        </section>

        <section id="integrity" aria-labelledby="integrity-title" className="scroll-mt-16 border-t border-border py-24 md:py-32">
          <div className={WRAP}>
            <Reveal>
              <SectionTitle id="integrity-title">Who decides what an observation means? A person.</SectionTitle>
              <Lede>
                Fairmark notes only what the candidate was told about at the start: leaving the page, exiting full screen,
                blocked pastes, dropped connections. It groups them into incidents with a plain explanation, and a person
                decides what, if anything, happens next.
              </Lede>
            </Reveal>
            <Flow
              className="mt-12"
              label="Integrity: observations are grouped into one explained incident, a person decides, nothing is automatic."
              nodes={[
                { icon: <Eye />, label: "3 observations", sub: "page hidden, back, a paste" },
                { icon: <FileText />, label: "1 explained incident", sub: "in plain words" },
                { icon: <UserCheck />, label: "A person decides", sub: "dismiss or follow up", tone: "brand" },
                { icon: <Ban />, label: "Automatic penalty", sub: "never", tone: "no" },
              ]}
            />
            <Reveal><Incidents /></Reveal>
          </div>
        </section>

        <section id="roles" aria-labelledby="roles-title" className="scroll-mt-16 border-t border-border py-24 md:py-32">
          <div className={WRAP}>
            <Reveal>
              <SectionTitle id="roles-title">One platform, three roles.</SectionTitle>
              <Lede>Each role sees only what it needs. Every permission is checked on the server, not just hidden in the interface.</Lede>
            </Reveal>
            <Reveal delay={0.1}><Roles /></Reveal>
          </div>
        </section>

        <section id="features" aria-labelledby="features-title" className="scroll-mt-16 border-t border-border py-24 md:py-32">
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
            <Reveal><Features /></Reveal>
          </div>
        </section>

        <Close />
      </main>
    </div>
  );
}
