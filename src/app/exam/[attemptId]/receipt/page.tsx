"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Copy, FileWarning, Hourglass, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AttemptState } from "@/contracts";
import { api } from "@/lib/client/api";
import { receiptKey, type StoredReceipt } from "@/lib/client/exam-engine";
import { RequestForm } from "@/components/exam/request-form";
import { useSessionItem } from "@/lib/client/use-browser";
import { Logo } from "@/components/common/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtDateTime, fmtTime } from "@/lib/utils";

export default function ReceiptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const stored = useSessionItem(receiptKey(attemptId));
  const [fetched, setFetched] = React.useState<StoredReceipt | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const data = React.useMemo<StoredReceipt | null>(() => (stored ? JSON.parse(stored) : fetched), [stored, fetched]);
  const [showRequest, setShowRequest] = React.useState(false);
  const [requested, setRequested] = React.useState(false);

  React.useEffect(() => {
    if (stored) return;
    api.get(`/api/attempts/${attemptId}`, AttemptState).then(
      (st) => (st.receipt ? setFetched({ receipt: st.receipt, notAccepted: [] }) : setError("This attempt hasn't been submitted yet.")),
      () => setError("Couldn't load your receipt."),
    );
  }, [attemptId, stored]);

  if (error) return <div className="mx-auto max-w-lg p-6"><Alert tone="warning">{error} <Link className="underline" href="/candidate">Back to my exams</Link></Alert></div>;
  if (!data) return <div className="mx-auto max-w-lg space-y-4 p-6"><Skeleton className="h-40" /><Skeleton className="h-24" /></div>;

  const r = data.receipt;
  const expired = r.reason === "expiry";
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-surface"><div className="mx-auto flex h-14 max-w-2xl items-center px-4"><Logo /></div></header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft">
            {expired ? <Hourglass className="size-8 text-success" aria-hidden /> : <CheckCircle2 className="size-8 text-success" aria-hidden />}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{expired ? "Time's up. Your exam was submitted" : "Your exam has been submitted"}</h1>
          <p className="mt-2 text-muted-foreground">{r.examTitle}</p>
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Receipt reference</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-2xl font-semibold tracking-wider">{r.receiptCode}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Copy receipt reference" onClick={() => navigator.clipboard?.writeText(r.receiptCode).then(() => toast.success("Copied"))}><Copy /></Button>
              </div>
            </div>
            <Item label="Received by the server" value={`${fmtDateTime(r.finalizedAt)} (${fmtTime(r.finalizedAt)})`} />
            <Item label="How it ended" value={expired ? "Submitted automatically at the deadline" : "Submitted by you"} />
            <Item label="Answers accepted" value={`${r.acceptedCount} of ${r.questionCount}`} />
            <Item label="Results" value={r.resultsStatus === "published" ? "Published" : "Pending. Your examiner will publish them."} />
          </CardContent>
        </Card>

        {data.notAccepted.length > 0 && (
          <Alert tone="warning" title="Some changes didn't reach the server in time">
            Your last edits to question{data.notAccepted.length > 1 ? "s" : ""} {data.notAccepted.join(", ")} were made while offline or after the deadline, so the earlier saved version was used.
          </Alert>
        )}

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

function Item({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>;
}
