"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Hand, XCircle } from "lucide-react";
import { ExamRequestList, type ExamRequest } from "@/contracts";
import { api } from "@/lib/client/api";
import { ExamSubnav } from "@/components/examiner/exam-subnav";
import { RequestDecisionDialog, RequestTypeBadge } from "@/components/examiner/request-decision";
import { PageHeader } from "@/components/common/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtDateTime, fmtDuration } from "@/lib/utils";

export default function RequestsPage() {
  const { examId } = useParams<{ examId: string }>();
  const [list, setList] = React.useState<ExamRequest[] | null>(null);
  const [error, setError] = React.useState(false);
  const [deciding, setDeciding] = React.useState<ExamRequest | null>(null);

  const load = React.useCallback(() => api.get(`/api/exams/${examId}/requests`, ExamRequestList).then((r) => { setList(r.requests); setError(false); }, () => setError(true)), [examId]);
  React.useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 10000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const pending = list?.filter((r) => r.status === "pending").length ?? 0;
  return (
    <>
      <ExamSubnav examId={examId} pendingRequests={pending} />
      <PageHeader title="Unlock & re-attempt requests" description="Every decision needs a note and is recorded with your name. Unlocking never adds time; a re-attempt voids the old attempt but keeps it on record." />
      {error && <Alert tone="warning" className="mb-4">Couldn&apos;t refresh the list.</Alert>}
      {!list ? <Skeleton className="h-64" /> : list.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed p-12 text-center">
          <Hand className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm text-muted-foreground">No requests yet. Candidates can ask for an unlock when their attempt locks, or for a re-attempt after a disruption.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-lg border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{r.candidateName}</p>
                <RequestTypeBadge type={r.type} />
                {r.status === "pending" && <Badge tone="flag">Pending</Badge>}
                {r.status === "approved" && <Badge tone="success"><CheckCircle2 aria-hidden />Approved</Badge>}
                {r.status === "denied" && <Badge tone="danger"><XCircle aria-hidden />Declined</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">“{r.reason}”</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Attempt {r.attemptStatus.replace("_", " ")} · {r.opensUsed} opens · {r.connectivityIncidents ? `offline ${r.connectivityIncidents}× (${fmtDuration(r.offlineSeconds)})` : "no connection drops seen"}
              </p>
              {r.status !== "pending" && r.decisionNote && (
                <p className="mt-2 rounded-md bg-surface-2 p-2 text-sm"><b>{r.decidedBy}:</b> {r.decisionNote}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "pending" && <Button size="sm" onClick={() => setDeciding(r)}>Review &amp; decide</Button>}
                <Button asChild size="sm" variant="ghost"><Link href={`/examiner/exams/${examId}/attempts/${r.attemptId}`}>Timeline <ArrowRight /></Link></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <RequestDecisionDialog request={deciding} open={!!deciding} onOpenChange={(o) => !o && setDeciding(null)} onDecided={load} />
    </>
  );
}
