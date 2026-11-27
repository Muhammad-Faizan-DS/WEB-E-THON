import Link from "next/link";
import { inOrder } from "@/server/database";
import { DataTable, Heading, Status, formatDate } from "@/components/backend-preview/common";
import { requireUser } from "@/components/dashboard/guard";
import { DashboardShell, StatGrid, ToolLinks } from "@/components/dashboard/shell";
import { candidateResults } from "@/server/grading";
import { candidateExams } from "@/server/start";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidate · SecureExam" };

type ExamRow = { id: string; title: string; startsAt: Date; endsAt: Date; accessStatus: string; attemptStatus: string | null };

export default async function CandidateDashboard() {
  const user = await requireUser("candidate");
  const [buckets, results] = await inOrder([candidateExams(user.id), candidateResults(user.id)]);
  const available = buckets.available as ExamRow[];
  const upcoming = buckets.upcoming as ExamRow[];
  const completed = buckets.completed as ExamRow[];
  const rows = [...available.map((exam) => ({ exam, when: "Available now" })), ...upcoming.map((exam) => ({ exam, when: "Upcoming" }))];
  return <DashboardShell user={user}>
    <Heading title={`Welcome, ${user.name}`} note="Candidate dashboard: your exams and published results." />
    <StatGrid items={[
      { label: "Available now", value: available.length },
      { label: "Upcoming", value: upcoming.length },
      { label: "Completed", value: buckets.completed.length },
      { label: "Published results", value: results.length },
    ]} />
    <div className="layout"><div className="stack">
      <section className="panel"><h2>My exams</h2>
        <DataTable headers={["Exam", "When", "Access", ""]} rows={rows.map(({ exam, when }) => [
          <strong key="title">{exam.title}</strong>,
          <div key="when">{when}<small>{formatDate(exam.startsAt.toISOString())} – {formatDate(exam.endsAt.toISOString())}</small></div>,
          <Status key="access" value={exam.attemptStatus === "in_progress" ? "in_progress" : exam.accessStatus} />,
          <Link key="open" href={`/candidate/exams/${exam.id}`}>{exam.attemptStatus === "in_progress" ? "Resume" : "Open"}</Link>,
        ])} />
      </section>
      <section className="panel"><h2>Completed</h2>
        <DataTable headers={["Exam", "Closed", "Status", ""]} rows={completed.map((exam) => [
          <strong key="title">{exam.title}</strong>, formatDate(exam.endsAt.toISOString()),
          <Status key="status" value={exam.attemptStatus ?? "not_attempted"} />,
          <Link key="open" href={exam.attemptStatus === "graded" ? "/candidate/results" : `/candidate/exams/${exam.id}`}>{exam.attemptStatus === "graded" ? "Result" : "Details"}</Link>,
        ])} />
      </section></div>
      <ToolLinks links={[
        { href: "/candidate/results", label: "Results", note: "Published scores, PDF and QR verification" },
        { href: "/candidate/settings", label: "Workspace settings", note: "Font size, theme, layout" },
      ]} />
    </div>
  </DashboardShell>;
}
