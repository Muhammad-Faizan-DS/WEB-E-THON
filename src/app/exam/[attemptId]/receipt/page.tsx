"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, CircleSlash, Copy, FileWarning, Hourglass, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AttemptState, type AttemptState as AttemptStateT } from "@/contracts";
import { api } from "@/lib/client/api";
import { receiptKey, type StoredReceipt } from "@/lib/client/exam-engine";
import { RequestForm } from "@/components/exam/request-form";
import { useStoredItem } from "@/lib/client/use-browser";
import { Logo } from "@/components/common/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtDateTime, fmtTime } from "@/lib/utils";

export default function ReceiptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const stored = useStoredItem(receiptKey(attemptId));
  const [fetched, setFetched] = React.useState<StoredReceipt | null>(null);
  const [state, setState] = React.useState<AttemptStateT | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const data = React.useMemo<StoredReceipt | null>(() => (stored ? JSON.parse(stored) : fetched), [stored, fetched]);
  const [showRequest, setShowRequest] = React.useState(false);
  const [requested, setRequested] = React.useState(false);

  // always ask the server what it kept, so the receipt can say which version of each answer counted
  React.useEffect(() => {
    api.get(`/api/attempts/${attemptId}`, AttemptState).then(
      (st) => {
        setState(st);
        if (stored) return;
        if (st.receipt) setFetched({ receipt: st.receipt, notAccepted: [] });
        else setError("This attempt hasn't been submitted yet.");
      },
      () => { if (!stored) setError("Couldn't load your receipt."); },
    );
  }, [attemptId, stored]);

  if (error) return <div className="mx-auto max-w-lg p-6"><Alert tone="warning">{error} <Link className="underline" href="/candidate">Back to my exams</Link></Alert></div>;
  if (!data) return <div className="mx-auto max-w-lg space-y-4 p-6"><Skeleton className="h-40" /><Skeleton className="h-24" /></div>;

  const r = data.receipt;
  const expired = r.reason === "expiry";
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-surface"><div className="mx-auto flex h-14 max-w-2xl items-center px-4"><Logo /></div></header>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-success/30 bg-success-soft">
            {expired ? <Hourglass className="size-7 text-success" aria-hidden /> : <CheckCircle2 className="size-7 text-success" aria-hidden />}
          </div>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.01em]">{expired ? "Time's up. Your exam was submitted" : "Your exam has been submitted"}</h1>
          <p className="mt-1.5 text-muted-foreground">{r.examTitle}</p>
        </div>

        <section aria-label="Receipt" className="rounded-lg border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <p className="text-[12px] text-muted-foreground">Receipt reference</p>
              <p className="mt-0.5 font-mono text-[22px] font-medium tracking-[0.04em]">{r.receiptCode}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(r.receiptCode).then(() => toast.success("Copied"))}><Copy /> Copy</Button>
          </div>
          <dl className="divide-y text-sm">
            <Item label="Received by the server" value={`${fmtDateTime(r.finalizedAt)} · ${fmtTime(r.finalizedAt)}`} />
            <Item label="How it ended" value={expired ? "Submitted automatically at the deadline" : "Submitted by you"} />
            <Item label="Answers accepted" value={`${r.acceptedCount} of ${r.questionCount}`} />
            <Item label="Results" value={r.resultsStatus === "published" ? "Published" : "Pending, your examiner publishes them"} />
          </dl>
        </section>

        {data.notAccepted.length > 0 && (
          <Alert tone="warning" title="Some changes didn't reach the server in time">
            Your last edits to question{data.notAccepted.length > 1 ? "s" : ""} {data.notAccepted.join(", ")} were made while offline or after the deadline, so the earlier saved version was used.
          </Alert>
        )}

        {state && <WhatCounted state={state} notAccepted={data.notAccepted} />}

        <Alert tone="info" title="What happens next">
          <p>Objective questions are marked automatically; written answers are marked by your examiner. You&apos;ll see your result on your exams page once it&apos;s published.</p>
        </Alert>

        {r.canRequestReattempt && (
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start gap-3">
                <FileWarning className="mt-0.5 size-5 text-warning" aria-hidden />
                <div>
                  <p className="font-medium">Something went wrong during your exam?</p>
                  <p className="text-sm text-muted-foreground">If a power cut, device failure or outage affected your attempt, you can ask your examiner for a re-attempt. They&apos;ll review what happened. Your current attempt stays on record either way.</p>
                </div>
              </div>
              {requested ? <Alert tone="success">Request sent. Check your exams page for the decision.</Alert>
                : showRequest ? <RequestForm attemptId={attemptId} type="reattempt" onSent={() => setRequested(true)} />
                : <Button variant="outline" onClick={() => setShowRequest(true)}><RotateCcw /> Request a re-attempt</Button>}
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button asChild size="lg"><Link href="/candidate">Back to my exams</Link></Button>
        </div>
      </main>
    </div>
  );
}

/** Per question: the version the server kept (and when), and whether a later edit on this device did not count. */
function WhatCounted({ state, notAccepted }: { state: AttemptStateT; notAccepted: number[] }) {
  return (
    <section aria-labelledby="counted-title" className="rounded-lg border bg-surface">
      <h2 id="counted-title" className="border-b px-5 py-3 text-[15px] font-semibold">What counted, question by question</h2>
      <ul className="divide-y text-sm">
        {state.questions.map((q) => {
          const a = state.answers.find((x) => x.aqId === q.aqId);
          const answered = !!a?.value && ("text" in a.value ? a.value.text.trim().length > 0 : a.value.optionIds.length > 0);
          const lost = notAccepted.includes(q.position);
          return (
            <li key={q.aqId} className="grid grid-cols-[3rem_1fr] gap-3 px-5 py-3">
              <span className="num font-medium">Q{q.position}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium">
                  {answered ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <CircleSlash className="size-4 text-muted-foreground" aria-hidden />}
                  {answered ? `Counted: version ${a!.revision}${a!.savedAt ? `, saved ${fmtTime(a!.savedAt)}` : ""}` : "No answer counted"}
                </p>
                {lost && (
                  <p className="mt-1 flex items-start gap-1.5 text-[13px] text-warning">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> A later edit on this device did not reach the server in time and was not counted.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[11rem_1fr] gap-4 px-5 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="num font-medium">{value}</dd></div>;
}
