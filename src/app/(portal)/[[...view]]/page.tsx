import Link from "next/link";
import { auth } from "@/server/auth";
import { SignInPanel, SignOutButton } from "@/components/backend-preview/sign-in";
import { Examiner } from "@/components/backend-preview/examiner";
import { Candidate } from "@/components/backend-preview/candidate";
import { Administrator } from "@/components/backend-preview/administrator";

export default async function PortalPage({ params, searchParams }: {
  params: Promise<{ view?: string[] }>; searchParams: Promise<{ attempt?: string; tab?: string }>;
}) {
  const user = (await auth())?.user;
  if (!user?.id || !user.role) return <SignInPanel />;
  const { view = [] } = await params;
  const { attempt, tab } = await searchParams;
  const role = user.role;
  const section = view[0] === role ? view[1] : undefined;
  return <div>
    <a className="skip" href="#workspace">Skip to workspace</a>
    <header className="topbar"><Link href={`/${role}`} className="brand"><span aria-hidden="true">SE</span>SecureExam</Link>
      <div className="account"><div><strong>{user.name}</strong><small>{role === "admin" ? "Administrator" : role}</small></div><SignOutButton /></div>
    </header>
    <main id="workspace" className="workspace">
      {role === "examiner" ? <Examiner section={section} examId={section === "exams" ? view[2] : undefined} attemptId={attempt} tab={tab} userId={user.id} name={user.name ?? "Examiner"} />
        : role === "admin" ? <Administrator section={section} examId={section === "exams" ? view[2] : undefined} /> : <Candidate section={section} examId={section === "exams" ? view[2] : undefined} attemptId={attempt} userId={user.id} name={user.name ?? "Candidate"} />}
    </main>
  </div>;
}
