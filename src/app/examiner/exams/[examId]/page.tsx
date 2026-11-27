"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Hand, Radio } from "lucide-react";
import { ExaminerDashboard, type ExaminerExamRow } from "@/contracts";
import { api } from "@/lib/client/api";
import { ExamSubnav } from "@/components/examiner/exam-subnav";
import { PhaseBadge } from "@/components/common/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatStrip } from "@/components/ui/card";
import { PreExamChecklist } from "@/components/examiner/pre-exam";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { fmtDateTime } from "@/lib/utils";

export default function ExamOverview() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = React.useState<ExaminerExamRow | null | undefined>(undefined);
  React.useEffect(() => {
    api.get("/api/exams", ExaminerDashboard).then((d) => setExam(d.exams.find((e) => e.examId === examId) ?? null), () => setExam(null));
  }, [examId]);

  if (exam === undefined) return <Skeleton className="h-64" />;
  if (exam === null) return <Alert tone="danger">This exam doesn&apos;t exist or isn&apos;t yours.</Alert>;

  const facts = [
    ["Window", `${fmtDateTime(exam.opensAt)} – ${fmtDateTime(exam.closesAt)}`], ["Duration", `${exam.durationMin} min`],
    ["Questions", String(exam.questionCount)], ["Total marks", String(exam.totalMarks)], ["Enrolled", String(exam.enrolled)],
    ["Submitted", String(exam.submitted)],
  ];
  return (
    <>
      <ExamSubnav examId={examId} pendingRequests={exam.pendingRequests} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{exam.title}</h1>
        <PhaseBadge phase={exam.phase} />
      </div>
      <StatStrip className="mb-8" items={facts.map(([k, v]) => ({ label: k, value: <span className="text-[17px]">{v}</span> }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="size-4 text-success" aria-hidden />Live monitor</CardTitle><CardDescription>Progress, contact, incidents and announcements for everyone in this exam.</CardDescription></CardHeader>
          <CardContent><Button asChild><Link href={`/examiner/exams/${examId}/monitor`}>Open monitor <ArrowRight /></Link></Button></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Hand className="size-4 text-flag" aria-hidden />Requests</CardTitle><CardDescription>{exam.pendingRequests ? `${exam.pendingRequests} waiting for your decision.` : "No pending unlock or re-attempt requests."}</CardDescription></CardHeader>
          <CardContent><Button asChild variant="outline"><Link href={`/examiner/exams/${examId}/requests`}>View requests <ArrowRight /></Link></Button></CardContent>
        </Card>
      </div>
      <PreExamChecklist examId={examId} />
    </>
  );
}
