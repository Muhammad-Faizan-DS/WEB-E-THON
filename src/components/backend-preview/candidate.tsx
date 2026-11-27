"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { workspacePrefs, type WorkspacePreferences } from "@/lib/contracts/operations";
import { DataTable, Feedback, Heading, Navigation, Status, formatDate } from "./common";
import { request, useAction, useResource } from "./client";
import { AttemptWorkspace } from "./workspace";
import { CameraGate, stopCamera } from "./camera";
import { isDesktop } from "./device";

type CandidateExam = { id: string; title: string; instructions: string; startsAt: string; endsAt: string;
  accessStatus: string; attemptId: string | null; attemptStatus: string | null; availableSeconds: number; allowPaste: boolean;
  cooldownUntil: string | null; requestStatus: string | null; requestReason: string | null; reattemptKey: string | null; cameraCheck: boolean };
type ExamBuckets = { available: CandidateExam[]; upcoming: CandidateExam[]; completed: CandidateExam[] };
type Result = { id: string; title: string; score: number; totalMarks: number; submittedAt: string; questions: Array<{
  position: number; marks: number; awarded: number; feedback: string | null; regradedAt: string | null;
}> };
const links: Array<[string, string]> = [["My exams", "/candidate"], ["Results", "/candidate/results"], ["Workspace settings", "/candidate/settings"]];

export function Candidate({ section, examId, attemptId, userId, name }: { section?: string; examId?: string; attemptId?: string; userId: string; name: string }) {
  const relevant = section !== "results" && section !== "settings";
  const exams = useResource<ExamBuckets>(relevant ? "/api/candidate/exams" : null, relevant ? 15_000 : undefined);
  const data = exams.data;
  const exam = data && [...data.available, ...data.upcoming, ...data.completed].find((item) => item.id === examId);
  const path = examId ? "/candidate/exams/" + examId : "/candidate";
  const current = relevant ? "/candidate" : "/candidate/" + section;
  if (attemptId && examId && exam) return <AttemptWorkspace key={attemptId} attemptId={attemptId} userId={userId} name={name}
    back="/candidate" allowPaste={exam.allowPaste} cameraRequired={exam.cameraCheck} />;
  return <><Navigation items={links} selected={current} />
    {section === "results" ? <Results /> : section === "settings" ? <Preferences /> :
      <><Feedback error={exams.error} pending={exams.pending} />
        {exam ? <ExamEntry exam={exam} path={path} userId={userId} available={Boolean(data?.available.some((item) => item.id === exam.id))} /> :
          data && (examId ? <Heading title="Exam unavailable" note="Open an exam from your candidate dashboard." /> : <ExamDashboard exams={data} />)}</>}
  </>;
}

function ExamDashboard({ exams }: { exams: ExamBuckets }) {
  return <><Heading title="My exams" note="Check your schedule and open an assigned assessment." />
    <div className="stack">{(["available", "upcoming", "completed"] as const).map((bucket) => <section className="panel" key={bucket}>
      <h2>{bucket === "available" ? "Available now" : bucket === "upcoming" ? "Upcoming" : "Completed"}</h2>
      <DataTable headers={["Exam", "Schedule", "Access", "Action"]} rows={exams[bucket].map((item) => [
        <strong key="title">{item.title}</strong>, <div key="time">{formatDate(item.startsAt)}<small>Closes {formatDate(item.endsAt)}</small></div>,
        <Status key="access" value={item.attemptStatus === "in_progress" ? "in_progress" : item.accessStatus} />,
        <Link key="open" href={"/candidate/exams/" + item.id}>{item.attemptStatus === "in_progress" ? "Resume exam" : "View exam"}</Link>,
      ])} />
    </section>)}</div></>;
}

function ExamEntry({ exam, path, userId, available }: { exam: CandidateExam; path: string; userId: string; available: boolean }) {
  const action = useAction();
  const router = useRouter();
  const [desktop, setDesktop] = useState<boolean>();
  const [cameraReady, setCameraReady] = useState(false);
  const handedOff = useRef(false);
  useEffect(() => { setDesktop(isDesktop()); }, []);
  useEffect(() => () => { if (!handedOff.current) stopCamera(); }, []);
  const reenter = exam.attemptStatus === "in_progress" && exam.attemptId;
  const canStart = available && exam.accessStatus === "active" && (!exam.attemptStatus || exam.attemptStatus === "voided");
  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void action.run(async () => {
      const result = await request<{ id: string; sessionId: string }>("/api/exams/" + exam.id + "/attempts", "POST", {
        key: data.get("key"), deviceCheck: isDesktop(), ...(exam.cameraCheck ? { cameraReady } : {}),
      });
      sessionStorage.setItem(`secureexam:${userId}:${result.data.id}`, result.data.sessionId);
      handedOff.current = true;
      router.push(path + "/attempt?attempt=" + result.data.id);
    }, "Exam started.");
  }
  return <><Heading title={exam.title} note={exam.instructions} action={<Link href="/candidate" className="button">All exams</Link>} />
    <Feedback error={action.error} note={action.note} />
    <div className="layout"><section className="panel"><h2>Exam access</h2>
      <dl className="facts"><div><dt>Opens</dt><dd>{formatDate(exam.startsAt)}</dd></div><div><dt>Closes</dt><dd>{formatDate(exam.endsAt)}</dd></div>
        <div><dt>Access</dt><dd><Status value={exam.accessStatus} /></dd></div>
        {exam.cooldownUntil && <div><dt>Cooldown ends</dt><dd>{formatDate(exam.cooldownUntil)}</dd></div>}
        {exam.requestStatus && <div><dt>Re-attempt request</dt><dd><Status value={exam.requestStatus} />{exam.requestReason && <p>{exam.requestReason}</p>}</dd></div>}</dl>
      {desktop === false && <p className="error">This exam can only be taken on a desktop or laptop computer.</p>}
      {desktop && reenter && <Link className="button primary" href={path + "/attempt?attempt=" + exam.attemptId}>Resume exam</Link>}
      {desktop && canStart && <form onSubmit={start}>
        <p>You have <strong>{Math.ceil(exam.availableSeconds / 60)} minutes</strong> available. Keep the exam in fullscreen and submit before time runs out.</p>
        <label>Activation key<input key={exam.reattemptKey ?? "key"} required autoComplete="off" maxLength={128} name="key" defaultValue={exam.reattemptKey ?? ""} /></label>
        <div><button className="primary" disabled={action.busy || (exam.cameraCheck && !cameraReady)}>Start exam</button></div>
      </form>}
      {!reenter && !canStart && <p className="muted">{exam.accessStatus === "blocked" ? "Contact an administrator about your blocked enrollment." : "There is no active exam entry for you right now."}</p>}
    </section>{desktop && canStart && exam.cameraCheck && <CameraGate onReady={setCameraReady} />}</div>
  </>;
}

function Results() {
  const results = useResource<Result[]>("/api/candidate/results");
  return <><Heading title="My results" note="View published scores, feedback, and verifiable reports." />
    <Feedback error={results.error} pending={results.pending} />
    <div className="stack">{results.data?.length === 0 && <section className="panel"><p className="empty">Your published results will appear here.</p></section>}
      {results.data?.map((result) => <section className="panel" key={result.id}><div className="section-row">
        <div><h2>{result.title}</h2><p>{result.score} / {result.totalMarks} · {formatDate(result.submittedAt)}</p></div>
        <a className="button primary" href={"/api/reports/" + result.id + "/pdf"}>Download result PDF</a></div>
        <DataTable headers={["Question", "Marks", "Feedback"]} rows={result.questions.map((item) => [
          item.position, `${item.awarded} / ${item.marks}`, <div key="feedback">{item.feedback ?? "—"}{item.regradedAt && <small>Regraded {formatDate(item.regradedAt)}</small>}</div>,
        ])} /></section>)}</div>
  </>;
}

function Preferences() {
  const prefs = useResource<WorkspacePreferences>("/api/me/prefs");
  const action = useAction(prefs.reload);
  return <><Heading title="Workspace preferences" /><section className="panel">
    <Feedback error={prefs.error || action.error} pending={prefs.pending} note={action.note} />
    {prefs.data && <form onSubmit={(event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      void action.run(() => request("/api/me/prefs", "PUT", workspacePrefs.parse(data)), "Preferences saved.");
    }}><div className="grid three"><label>Font size<select name="fontSize" defaultValue={prefs.data.fontSize}>
      <option value="normal">Normal</option><option value="large">Large</option><option value="extra-large">Extra large</option></select></label>
      <label>Theme<select name="theme" defaultValue={prefs.data.theme}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>Layout<select name="layout" defaultValue={prefs.data.layout}><option value="split">Split view</option><option value="single">Single view</option><option value="list">List view</option></select></label></div>
      <div><button className="primary" disabled={action.busy}>Save preferences</button></div></form>}
  </section></>;
}
