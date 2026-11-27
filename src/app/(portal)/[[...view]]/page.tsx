import { notFound, redirect } from "next/navigation";
import { Examiner } from "@/components/backend-preview/examiner";
import { Candidate } from "@/components/backend-preview/candidate";
import { Administrator } from "@/components/backend-preview/administrator";
import { requireUser, roleHome } from "@/components/dashboard/guard";
import { DashboardShell } from "@/components/dashboard/shell";

// Role dashboards live at /admin, /examiner and /candidate. This catch-all only serves "/" (redirect)
// and the deeper reference tools, e.g. /admin/users or /examiner/exams/:id.
export default async function PortalPage({ params, searchParams }: {
  params: Promise<{ view?: string[] }>; searchParams: Promise<{ attempt?: string; tab?: string }>;
}) {
  const { view = [] } = await params;
  if (view[0] === "api") notFound();
  const user = await requireUser();
  if (view[0] !== user.role || view.length < 2) redirect(roleHome(user.role));
  const { attempt, tab } = await searchParams;
  const section = view[1];
  if (user.role === "examiner" && section === "questions") redirect("/examiner");
  const examId = section === "exams" ? view[2] : undefined;
  if (attempt && examId) {
    return <main id="workspace" className="workspace exam-focus">
      {user.role === "examiner" ? <Examiner section={section} examId={examId} attemptId={attempt} tab={tab} userId={user.id} name={user.name} />
        : <Candidate section={section} examId={examId} attemptId={attempt} userId={user.id} name={user.name} />}
    </main>;
  }
  return <DashboardShell user={user}>
    {user.role === "examiner" ? <Examiner section={section} examId={examId} attemptId={attempt} tab={tab} userId={user.id} name={user.name} />
      : user.role === "admin" ? <Administrator section={section} examId={examId} />
        : <Candidate section={section} examId={examId} attemptId={attempt} userId={user.id} name={user.name} />}
  </DashboardShell>;
}
