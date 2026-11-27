import Link from "next/link";
import { inOrder } from "@/server/database";
import { DataTable, Heading, Status, formatDate } from "@/components/backend-preview/common";
import { requireUser } from "@/components/dashboard/guard";
import { DashboardShell, StatGrid, ToolLinks } from "@/components/dashboard/shell";
import { listAccounts } from "@/server/admin";
import { listExams } from "@/server/exams";
import { listRequests } from "@/server/requests";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrator · SecureExam" };

export default async function AdminDashboard() {
  const user = await requireUser("admin");
  const [accounts, exams, requests] = await inOrder([listAccounts(), listExams(), listRequests(user)]);
  const count = (role: string) => accounts.filter((account) => account.role === role && account.active).length;
  return <DashboardShell user={user}>
    <Heading title={`Welcome, ${user.name}`} note="Administrator dashboard: accounts, exam oversight and re-attempt decisions." />
    <StatGrid items={[
      { label: "Active examiners", value: count("examiner") },
      { label: "Active candidates", value: count("candidate") },
      { label: "Exams", value: exams.length, hint: `${exams.filter((exam) => exam.status === "published").length} published` },
      { label: "Requests to decide", value: requests.filter((item) => item.status === "pending_admin").length },
    ]} />
    <div className="layout">
      <section className="panel"><h2>All exams</h2>
        <DataTable headers={["Exam", "Status", "Window"]} rows={exams.slice(0, 8).map((exam) => [
          <Link key="title" href={`/portal/admin/exams/${exam.id}`}>{exam.title}</Link>,
          <Status key="status" value={exam.resultsPublished ? "results_published" : exam.status} />,
          <div key="window">{formatDate(exam.startsAt.toISOString())}<small>Closes {formatDate(exam.endsAt.toISOString())}</small></div>,
        ])} />
      </section>
      <ToolLinks links={[
        { href: "/portal/admin/users", label: "Users", note: "Create, import, change role, deactivate" },
        { href: "/portal/admin/exams", label: "Exam oversight", note: "Live monitor across examiners" },
        { href: "/portal/admin/requests", label: "Re-attempt requests", note: "Approve or reject, unblock" },
        { href: "/portal/admin/audit", label: "Audit log", note: "Every privileged action" },
      ]} />
    </div>
  </DashboardShell>;
}
