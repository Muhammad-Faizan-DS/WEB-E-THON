"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Radio } from "lucide-react";
import { ExaminerDashboard, type ExaminerExamRow } from "@/contracts";
import { api } from "@/lib/client/api";
import { PageHeader } from "@/components/common/app-shell";
import { PhaseBadge } from "@/components/common/status";
import { Button } from "@/components/ui/button";
import { StatStrip } from "@/components/ui/card";
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
  const tiles: { label: string; n: number; alert?: boolean }[] = [
    { label: "Live now", n: ex.filter((e) => e.phase === "ongoing").length },
    { label: "Scheduled", n: ex.filter((e) => e.phase === "scheduled").length },
    { label: "Drafts", n: ex.filter((e) => e.phase === "draft").length },
    { label: "Awaiting grading", n: ex.reduce((s, e) => s + e.awaitingGrading, 0) },
    { label: "Pending requests", n: ex.reduce((s, e) => s + e.pendingRequests, 0), alert: true },
    { label: "Unreviewed priority", n: ex.reduce((s, e) => s + e.priorityIncidents, 0), alert: true },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="What needs your attention across your exams."  />
      {error && <Alert tone="warning" className="mb-4">Couldn&apos;t refresh. Showing the last data loaded.</Alert>}
      <StatStrip className="mb-10" items={tiles.map((t) => ({ label: t.label, value: data ? t.n : "–", tone: data && t.n > 0 && t.alert ? "text-danger" : undefined }))} />
      <h2 className="mb-3 text-base font-semibold">Your exams</h2>
      {!data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <ul className="divide-y rounded-lg border bg-surface">
          {ex.map((e) => <ExamRow key={e.examId} e={e} />)}
        </ul>
      )}
    </>
  );
}

function ExamRow({ e }: { e: ExaminerExamRow }) {
  return (
    <li className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
      <div className="min-w-64 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link href={`/examiner/exams/${e.examId}`} className="text-[15px] font-semibold hover:underline">{e.title}</Link>
          <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <PhaseBadge phase={e.phase} />
          <span className="num">{fmtDateTime(e.opensAt)} – {fmtDateTime(e.closesAt)}</span>
          {e.priorityIncidents > 0 && <span className="inline-flex items-center gap-1 font-medium text-danger"><AlertTriangle className="size-3.5" aria-hidden />{e.priorityIncidents} priority to review</span>}
        </div>
      </div>
      <dl className="num grid grid-cols-4 gap-x-5 gap-y-2 text-sm sm:flex sm:gap-7">
        <Num label="Enrolled" n={e.enrolled} />
        <Num label="In progress" n={e.inProgress} />
        <Num label="Submitted" n={e.submitted} />
        <Num label="To grade" n={e.awaitingGrading} highlight={e.awaitingGrading > 0} />
      </dl>
      <div className="flex gap-2">
        {e.phase === "ongoing" && <Button asChild size="sm"><Link href={`/examiner/exams/${e.examId}/monitor`}><Radio /> Monitor</Link></Button>}
        <Button asChild size="sm" variant="ghost"><Link href={`/examiner/exams/${e.examId}`}>Open</Link></Button>
      </div>
    </li>
  );
}

function Num({ label, n, highlight }: { label: string; n: number; highlight?: boolean }) {
  return <div className="min-w-0"><dt className="text-[12px] leading-tight text-muted-foreground sm:whitespace-nowrap">{label}</dt><dd className={cn("text-[15px] font-semibold tabular-nums", highlight && "text-warning")}>{n}</dd></div>;
}
