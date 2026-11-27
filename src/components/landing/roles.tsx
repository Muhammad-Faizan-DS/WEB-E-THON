"use client";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AuditLog, CertificateQr, ClipboardMarks, IdTick, ImportRows, IncidentNote, KeyReset, LaptopClock, LivePulse, PaperPencil, PenWrite, ReceiptTick,
} from "./pictograms";

type Item = { icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement; title: string; sub: string };
const ROLES: Record<"candidate" | "examiner" | "admin", { label: string; icon: Item["icon"]; items: Item[]; mock: "candidate" | "examiner" | "admin" }> = {
  candidate: {
    label: "Candidate",
    icon: LaptopClock,
    items: [
      { icon: LaptopClock, title: "A timer you can trust", sub: "Kept by the server" },
      { icon: PenWrite, title: "Answer, flag, take notes", sub: "Scratchpad is never graded" },
      { icon: ReceiptTick, title: "Submit, keep a receipt", sub: "Exactly what counted" },
      { icon: CertificateQr, title: "Results you can prove", sub: "PDF with a verify code" },
    ],
    mock: "candidate",
  },
  examiner: {
    label: "Examiner",
    icon: ClipboardMarks,
    items: [
      { icon: PaperPencil, title: "Build and publish", sub: "Three question types" },
      { icon: LivePulse, title: "Monitor live", sub: "Who needs a decision" },
      { icon: IncidentNote, title: "Explained incidents", sub: "You decide, it's recorded" },
      { icon: ClipboardMarks, title: "Grade and analyse", sub: "Flags a key that looks wrong" },
    ],
    mock: "examiner",
  },
  admin: {
    label: "Admin",
    icon: IdTick,
    items: [
      { icon: IdTick, title: "Manage accounts", sub: "Disable without deleting" },
      { icon: KeyReset, title: "Reset access", sub: "One-time temporary password" },
      { icon: ImportRows, title: "Import candidates", sub: "Row errors before saving" },
      { icon: AuditLog, title: "Read the audit log", sub: "Who did what, and when" },
    ],
    mock: "admin",
  },
};

type RoleKey = keyof typeof ROLES;

/**
 * One tab per role. Each panel shows what that role does as four pictogram tiles (a few words each),
 * beside a glass picture of their screen on a soft emerald light.
 */
export function Roles() {
  const [tab, setTab] = React.useState<RoleKey>("candidate");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as RoleKey)} className="mt-12">
      <TabsList aria-label="Roles" className="mx-auto w-fit gap-2 rounded-xl border-0 bg-surface-2 p-1.5">
        {(Object.keys(ROLES) as RoleKey[]).map((k) => {
          const Icon = ROLES[k].icon;
          return (
            <TabsTrigger
              key={k}
              value={k}
              className="h-11 gap-2 rounded-lg border-0 px-3 font-display text-[14px] font-semibold sm:px-4 sm:text-[15px] text-muted-foreground [--pg-accent:var(--primary)] data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgb(0_0_0/0.08)] [&_svg]:size-5"
            >
              <span className="hidden sm:inline-flex"><Icon /></span> {ROLES[k].label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {(Object.keys(ROLES) as RoleKey[]).map((k) => (
        <TabsContent key={k} value={k} className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
          <ul className="grid grid-cols-2 gap-3">
            {ROLES[k].items.map((it, i) => (
              <li
                key={it.title}
                className="flex animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-4 rounded-xl border border-border bg-surface p-5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span aria-hidden className="grid size-14 place-items-center rounded-full border-2 border-border-strong text-foreground [--pg-accent:var(--primary)] [&_svg]:size-7">
                  <it.icon />
                </span>
                <div>
                  <p className="font-display text-[16px] leading-tight font-semibold tracking-[-0.01em]">{it.title}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{it.sub}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute -inset-6 bg-[radial-gradient(45%_50%_at_35%_40%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%),radial-gradient(35%_40%_at_75%_70%,color-mix(in_oklab,#14b8a6_18%,transparent),transparent_70%)]" />
            <div className="relative"><RoleMock kind={ROLES[k].mock} /></div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-surface/50">
      <figcaption className="flex items-center justify-between border-b border-foreground/[0.07] px-5 py-3">
        <span className="font-display text-[13px] font-semibold">{title}</span>
        <span className="text-[12px] text-muted-foreground">Sample data</span>
      </figcaption>
      <div className="p-5">{children}</div>
    </figure>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />;
}

function RoleMock({ kind }: { kind: "candidate" | "examiner" | "admin" }) {
  if (kind === "candidate") {
    return (
      <Shell title="My exams">
        <ul className="divide-y divide-border text-[14px]">
          {[
            ["Data Science Fundamentals", "DSF-101 · closes in 8 h 40 min", "bg-success", "Available"],
            ["Machine Learning Midterm", "ML-210 · opens tomorrow, 10:00", "bg-info", "Upcoming"],
            ["Statistics Quiz 1", "STAT-110 · 24 / 30", "bg-primary", "Results published"],
          ].map(([t, s, dot, st]) => (
            <li key={t} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{t}</p>
                <p className="truncate text-[13px] text-muted-foreground">{s}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-[13px] font-medium"><Dot className={dot} />{st}</span>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }
  if (kind === "examiner") {
    const bars = [2, 5, 9, 14, 18, 12, 6, 3];
    return (
      <Shell title="Statistics Quiz 1 · Analytics">
        <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border text-[13px]">
          {[["Mean", "21.4"], ["Median", "22"], ["Graded", "24 / 24"]].map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <p className="text-muted-foreground">{k}</p>
              <p className="font-display text-[20px] font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div aria-hidden className="mt-5 flex h-28 items-end gap-1.5">
          {bars.map((b, i) => <div key={i} className="flex-1 rounded-t-md bg-primary/80" style={{ height: `${(b / 18) * 100}%` }} />)}
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-[13px]"><Dot className="bg-warning-dot" /><span><span className="font-medium">Q6: check the key.</span> Strong candidates got it wrong more often than weak ones.</span></p>
      </Shell>
    );
  }
  return (
    <Shell title="Audit log">
      <ul className="divide-y divide-border text-[13px]">
        {[
          ["10:44", "examiner@exam.test", "Approved re-attempt for Omar F.", "Reason recorded"],
          ["10:31", "examiner@exam.test", "Followed up incident on Bilal A.", "No mark change"],
          ["09:58", "admin@exam.test", "Reset password for cand07", "Owner notified in app"],
          ["09:12", "admin@exam.test", "Imported 24 candidates", "0 rows rejected"],
        ].map(([t, who, what, note]) => (
          <li key={t + what} className="grid grid-cols-[3rem_1fr] gap-3 py-3">
            <span className="font-mono text-muted-foreground tabular-nums">{t}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{what}</p>
              <p className="truncate text-muted-foreground">{who} · {note}</p>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
