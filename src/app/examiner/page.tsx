"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardCheck, FilePen, Hand, Plus, Radio, Send } from "lucide-react";
import { ExaminerDashboard, type ExaminerExamRow } from "@/contracts";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/common/app-shell";
import { PhaseBadge } from "@/components/common/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { cn, fmtDateTime } from "@/lib/utils";

export default function ExaminerHome() {
  const [data, setData] = React.useState<ExaminerDashboard | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const load = () => api.get("/api/exams", ExaminerDashboard).then((d) => { setData(d); setError(false); }, () => setError(true));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const ex = data?.exams ?? [];
  const tiles = [
    { label: "Drafts", n: ex.filter((e) => e.phase === "draft").length, icon: FilePen, tone: "text-muted-foreground" },
    { label: "Scheduled", n: ex.filter((e) => e.phase === "scheduled").length, icon: CalendarClock, tone: "text-info" },
    { label: "Live now", n: ex.filter((e) => e.phase === "ongoing").length, icon: Radio, tone: "text-success" },
    { label: "Awaiting grading", n: ex.reduce((s, e) => s + e.awaitingGrading, 0), icon: ClipboardCheck, tone: "text-warning" },
    { label: "Ready to publish", n: ex.filter((e) => e.phase === "completed" && e.awaitingGrading === 0 && e.submitted > 0).length, icon: Send, tone: "text-primary" },
    { label: "Pending requests", n: ex.reduce((s, e) => s + e.pendingRequests, 0), icon: Hand, tone: "text-flag" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="What needs your attention across your exams." actions={<Button asChild><Link href="/examiner/exams/new"><Plus /> New exam</Link></Button>} />
      {error && <Alert tone="warning" className="mb-4">Couldn&apos;t refresh. Showing the last data loaded.</Alert>}
      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-surface p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><t.icon className={cn("size-4", t.tone)} aria-hidden />{t.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{data ? t.n : "–"}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mb-3 text-lg font-semibold">Your exams</h2>
      {!data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <Card className="divide-y overflow-hidden">
          {ex.map((e) => <ExamRow key={e.examId} e={e} />)}
        </Card>
      )}
    </>
  );
}

function ExamRow({ e }: { e: ExaminerExamRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <div className="min-w-56 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/examiner/exams/${e.examId}`} className="font-semibold hover:underline">{e.title}</Link>
          <PhaseBadge phase={e.phase} />
          {e.priorityIncidents > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle className="size-3.5" aria-hidden />{e.priorityIncidents} priority review</span>}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground"><span className="font-mono">{e.code}</span> · {fmtDateTime(e.opensAt)} – {fmtDateTime(e.closesAt)} · {e.durationMin} min · {e.totalMarks} marks</p>
      </div>
      <dl className="flex gap-6 text-sm">
        <Num label="Enrolled" n={e.enrolled} />
        <Num label="In progress" n={e.inProgress} />
        <Num label="Submitted" n={e.submitted} />
        <Num label="To grade" n={e.awaitingGrading} highlight={e.awaitingGrading > 0} />
      </dl>
      <div className="flex gap-2">
        {e.phase === "ongoing" && <Button asChild size="sm"><Link href={`/examiner/exams/${e.examId}/monitor`}><Radio /> Monitor</Link></Button>}
        {e.awaitingGrading > 0 && <Button asChild size="sm" variant="outline"><Link href={`/examiner/exams/${e.examId}/grading`}>Grade</Link></Button>}
        <Button asChild size="sm" variant="ghost"><Link href={`/examiner/exams/${e.examId}`}>Open</Link></Button>
      </div>
    </div>
  );
}

function Num({ label, n, highlight }: { label: string; n: number; highlight?: boolean }) {
  return <div className="text-center"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("font-semibold tabular-nums", highlight && "text-warning")}>{n}</dd></div>;
}
