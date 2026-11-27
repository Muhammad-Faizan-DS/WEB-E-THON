"use client";
import * as React from "react";
import { BarChart3, ClipboardCheck, FileUp, KeyRound, LayoutList, Megaphone, NotebookPen, ScrollText, ShieldCheck, Timer, UserCog, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ROLES = {
  candidate: {
    label: "Candidate",
    items: [
      [Timer, "A timer you can trust", "Kept by the server, so refreshing or a new device never changes it."],
      [NotebookPen, "Answer, flag, take notes", "Single, multiple and written answers, a question navigator and a scratchpad that is never graded."],
      [ClipboardCheck, "Review, submit, keep a receipt", "See what's unanswered, submit once, and get a receipt of exactly what was accepted."],
      [ShieldCheck, "Results you can prove", "Published results with feedback, a PDF and a code anyone can verify."],
    ],
    mock: "candidate",
  },
  examiner: {
    label: "Examiner",
    items: [
      [LayoutList, "Build from a question bank", "Topics, difficulty, three question types, and CSV or JSON import with a dry run."],
      [Megaphone, "Monitor live", "Who is in progress, offline, locked or needs review, with announcements to everyone."],
      [ScrollText, "Read explained incidents", "Observations grouped into plain-language incidents. You decide, and decisions are recorded."],
      [BarChart3, "Grade and analyse", "Auto-grading, a written-answer queue, and analytics that flag a key that looks wrong."],
    ],
    mock: "examiner",
  },
  admin: {
    label: "Admin",
    items: [
      [Users, "Manage accounts", "Create, disable and re-enable users and assign one of three roles."],
      [KeyRound, "Reset access", "Reset passwords without ever seeing them."],
      [FileUp, "Import candidates", "Bulk import with row-by-row errors before anything is saved."],
      [UserCog, "Read the audit log", "Every sensitive action is written down with who did it and when."],
    ],
    mock: "admin",
  },
} as const;

type RoleKey = keyof typeof ROLES;

/** Underline tabs, one per role: what that role does, beside a small picture of their screen. */
export function Roles() {
  const [tab, setTab] = React.useState<RoleKey>("candidate");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as RoleKey)} className="mt-12">
      <TabsList aria-label="Roles" className="gap-8">
        {(Object.keys(ROLES) as RoleKey[]).map((k) => (
          <TabsTrigger key={k} value={k} className="h-12 font-display text-[16px] font-semibold">
            {ROLES[k].label}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(ROLES) as RoleKey[]).map((k) => (
        <TabsContent key={k} value={k} className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <ul className="divide-y divide-border">
            {ROLES[k].items.map(([Icon, title, body]) => (
              <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5 first:pt-0">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <RoleMock kind={ROLES[k].mock} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface ">
      <figcaption className="flex items-center justify-between border-b border-border px-5 py-3">
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
