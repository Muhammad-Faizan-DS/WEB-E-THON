import Link from "next/link";
import { inOrder } from "@/server/database";
import { ExamDirectory, type ExamListRow } from "@/components/backend-preview/exam-directory";
import { requireUser } from "@/components/dashboard/guard";
import { DashboardShell } from "@/components/dashboard/shell";
import { listExams } from "@/server/exams";
import { listRequests } from "@/server/requests";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exams · SecureExam" };

export default async function ExaminerDashboard() {
  const user = await requireUser("examiner");
  const [exams, requests] = await inOrder([listExams(user.id), listRequests(user)]);
  const now = new Date();
  const rows: ExamListRow[] = exams.map((exam) => ({
    id: exam.id, title: exam.title, course: exam.course, examType: exam.examType,
    startsAt: exam.startsAt.toISOString(), endsAt: exam.endsAt.toISOString(), durationMin: exam.durationMin,
    status: exam.resultsPublished ? "results_published" : exam.status === "draft" ? "draft" : now < exam.startsAt ? "scheduled" : now < exam.endsAt ? "open" : "closed",
  }));
  const pending = requests.filter((item) => item.status === "pending_examiner").length;
  return <DashboardShell user={user}><div className="exam-directory">
    <div className="heading exam-heading"><div><h1>Exams</h1><p>Create assessments and manage questions, candidates, and results.</p></div>
      <Link className="button primary" href="/portal/examiner/exams/new">Create exam</Link></div>
    <ExamDirectory exams={rows} />
    <Link className="exam-requests-link" href="/portal/examiner/requests">Re-attempt requests{pending ? ` (${pending} pending)` : ""}</Link>
  </div></DashboardShell>;
}

