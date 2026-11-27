"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { MyResult } from "@/lib/client/results";
import { PageHeader } from "@/components/common/app-shell";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtDateTime } from "@/lib/utils";

export default function ResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const [r, setR] = React.useState<MyResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.get(`/api/me/exams/${examId}/result`, MyResult).then(setR, (e: ApiError) => setError(e.message));
  }, [examId]);

  return (
    <>
      <Link href="/candidate" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"><ArrowLeft className="size-4" aria-hidden /> My exams</Link>
      {error ? <Alert tone="warning" title="Result not available">{error}</Alert> : !r ? (
        <div className="space-y-3"><Skeleton className="h-10 w-80" /><Skeleton className="h-40" /></div>
      ) : (
        <>
          <PageHeader
            title={r.title}
            description={<span><span className="font-mono">{r.code}</span> · {r.examinerName} · published {fmtDateTime(r.publishedAt)}</span>}
            actions={r.scorePct !== null ? <Button variant="outline" onClick={() => window.print()} className="print:hidden"><Printer /> Print or save as PDF</Button> : undefined}
          />
          {r.scorePct === null ? (
            <Alert tone="info" title="No result on record for you">
              Results for this exam are published, but there is no marked attempt for your account. If you sat this exam, contact your examiner.
            </Alert>
          ) : (
            <section aria-label="Your result" className="overflow-hidden rounded-lg border bg-surface">
              <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-4"><p className="text-[13px] text-muted-foreground">Score</p><p className="num mt-1 text-[32px] font-semibold leading-none">{r.scorePct}%</p></div>
                <div className="px-5 py-4"><p className="text-[13px] text-muted-foreground">Marks</p><p className="num mt-1 text-[32px] font-semibold leading-none">{r.marks} <span className="text-[18px] font-normal text-muted-foreground">/ {r.totalMarks}</span></p></div>
                <div className="px-5 py-4"><p className="text-[13px] text-muted-foreground">Questions</p><p className="num mt-1 text-[32px] font-semibold leading-none">{r.questionCount}</p></div>
              </div>
              <dl className="divide-y border-t text-sm">
                <div className="grid grid-cols-[9rem_1fr] gap-4 px-5 py-3"><dt className="text-muted-foreground">Candidate</dt><dd className="font-medium">{r.candidateName}{r.studentId && <span className="ml-2 font-mono text-[12px] text-muted-foreground">{r.studentId}</span>}</dd></div>
                <div className="grid grid-cols-[9rem_1fr] gap-4 px-5 py-3"><dt className="text-muted-foreground">How it was marked</dt><dd>Objective questions automatically, from the exact paper you received; written answers by your examiner.</dd></div>
              </dl>
            </section>
          )}
          <p className="mt-4 text-[13px] text-muted-foreground print:hidden">Think a mark is wrong? Ask your examiner for a review; the original record is kept.</p>
        </>
      )}
    </>
  );
}
