"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DataTable, Feedback, Heading, Status } from "./common";
import { request, useAction, useResource } from "./client";
import { ExamQuestions } from "./exam-questions";
import { ExamBuilder, type ExamDetail } from "./exam-builder";
import { AnalyticsPanel, GradingPanel, MonitorPanel } from "./exam-operations";
import { RequestsPanel } from "./administrator";
import { DisputesPanel } from "./disputes";
import { AttemptWorkspace } from "./workspace";
import { isDesktop } from "./device";

const tools: Array<[string, string]> = [
  ["Questions", "questions"], ["Settings", "settings"], ["Candidates & keys", "candidates"],
  ["Live monitor", "monitor"], ["Grading & results", "grading"], ["Analytics", "analytics"],
];

export function Examiner({ section, examId, attemptId, tab, userId, name }: {
  section?: string; examId?: string; attemptId?: string; tab?: string; userId: string; name: string;
}) {
  if (examId && attemptId) return <AttemptWorkspace key={attemptId} attemptId={attemptId} userId={userId} name={name} back={"/portal/examiner/exams/" + examId} sandbox />;
  if (section === "requests") return <><Breadcrumb current="Re-attempt requests" /><RequestsPanel admin={false} /></>;
  if (section === "disputes") return <DisputesPanel role="examiner" />;
  if (examId === "new") return <ExamBuilder />;
  if (examId) return <ManageExam key={examId} examId={examId} tab={tab} userId={userId} />;
  return <><Breadcrumb current="Exam tools" /><Heading title="Exam tools" note="Open one of your exams to manage its questions and settings." /></>;
}

function Breadcrumb({ current }: { current: string }) {
  return <nav className="exam-crumbs" aria-label="Breadcrumb"><Link href="/portal/examiner">Exams</Link><span aria-hidden="true">/</span><span aria-current="page">{current}</span></nav>;
}

function ManageExam({ examId, tab, userId }: { examId: string; tab?: string; userId: string }) {
  const path = "/portal/examiner/exams/" + examId;
  const api = "/api/exams/" + examId;
  const detail = useResource<ExamDetail>("/api/exams?id=" + examId);
  const checklist = useResource<{ canPublish: boolean; issues: string[] }>(api + "/checklist");
  const refresh = async () => { await Promise.all([detail.reload(), checklist.reload()]); };
  const action = useAction(refresh);
  const router = useRouter();
  const exam = detail.data;
  const current = tools.some(([, key]) => key === tab) ? tab! : "questions";

  async function sandbox() {
    const result = await action.run(() => request<{ id: string; sessionId: string }>(api + "/attempts", "POST", { sandbox: true, deviceCheck: isDesktop() }), "Sandbox ready.");
    if (!result) return;
    sessionStorage.setItem(`secureexam:${userId}:${result.data.id}`, result.data.sessionId);
    router.push(path + "?attempt=" + result.data.id);
  }

  return <>
    <Breadcrumb current={exam?.title ?? "Manage exam"} />
    <div className="heading exam-heading">
      <div><h1>{exam?.title ?? "Manage exam"}</h1>
        {exam && <div className="exam-meta"><Status value={exam.resultsPublished ? "results_published" : exam.status} />
          {exam.course && <span>{exam.course}</span>}<span>{exam.durationMin} min</span><span>{exam.totalMarks} marks</span></div>}</div>
      {exam && <div className="actions exam-actions">
        <button disabled={action.busy || !checklist.data?.canPublish} onClick={() => void sandbox()}>Sandbox preview</button>
        {exam.status === "draft" ? <button className="primary" disabled={action.busy || !checklist.data?.canPublish}
          onClick={() => void action.run(() => request(api + "/publish", "POST"), "Exam published.")}>Publish exam</button>
          : !exam.frozenAt && <button disabled={action.busy} onClick={() => void action.run(() => request(api + "/unpublish", "POST"), "Exam returned to draft.")}>Unpublish</button>}
      </div>}
    </div>
    <Feedback error={detail.error || action.error || checklist.error} pending={detail.pending} note={action.note} />
    {exam && <>
      <nav className="exam-tabs" aria-label="Exam tools">{tools.map(([label, key]) =>
        <Link key={key} href={path + "?tab=" + key} aria-current={key === current ? "page" : undefined}>{label}</Link>)}</nav>
      {current === "questions" && <><ExamQuestions exam={exam} reload={refresh} /><PublishChecklist checklist={checklist.data} /></>}
      {current === "settings" && <><ExamBuilder exam={exam} reload={refresh} /><PublishChecklist checklist={checklist.data} /></>}
      {current === "candidates" && <Enrollments exam={exam} reload={detail.reload} />}
      {current === "monitor" && <MonitorPanel examId={examId} />}
      {current === "grading" && <GradingPanel exam={exam} reload={detail.reload} />}
      {current === "analytics" && <AnalyticsPanel examId={examId} />}
    </>}
  </>;
}

type Checklist = { canPublish: boolean; issues: string[]; paper?: { questions: number; marks: number; totalMarks: number };
  sections?: Array<{ title: string; poolQuestions: number; paperQuestions: number; paperMarks: number; drawsSubset: boolean }> };

function PublishChecklist({ checklist }: { checklist?: Checklist }) {
  if (!checklist) return null;
  return <section className="panel publish-checklist">
    <h2>Publish checklist</h2>
    {checklist.canPublish ? <p className="notice">Ready to publish.</p> : <ul>{checklist.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    {checklist.paper && <p>Each candidate paper: <strong>{checklist.paper.questions} questions · {checklist.paper.marks} marks</strong> (exam total {checklist.paper.totalMarks}).</p>}
    {checklist.sections?.some((section) => section.drawsSubset) && <ul className="muted">{checklist.sections.filter((section) => section.drawsSubset).map((section) =>
      <li key={section.title}>{section.title}: draws {section.paperQuestions} of {section.poolQuestions} questions per candidate, seeded by their activation key.</li>)}</ul>}
  </section>;
}

type KeyRow = { enrollmentId: string; candidateId: string; name: string; email: string; isExternal: boolean; enrollmentStatus: string;
  status: string; key: string | null; hint: string | null; failedTries: number | null; usedAt: string | null };
type Enrolled = { candidateId: string; email: string; isExternal: boolean; temporaryPassword: string | null; key: string | null };

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
const cell = (value: string) => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

function Enrollments({ exam, reload }: { exam: ExamDetail; reload: () => Promise<void> }) {
  const api = "/api/exams/" + exam.id;
  const keys = useResource<KeyRow[]>(exam.status === "published" ? api + "/keys" : null);
  const job = useAction(async () => { await Promise.all([reload(), keys.reload()]); });
  const [selected, setSelected] = useState<string[]>([]);
  const [created, setCreated] = useState<Enrolled[]>([]);
  const rows = keys.data ?? [];
  const enroll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const accommodations = { timeMultiplier: Number(data.get("multiplier")), allowPaste: data.has("paste") };
    const candidates = String(data.get("people")).split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean).map((value) =>
      /^[0-9a-f-]{36}$/i.test(value) ? { candidateId: value, ...accommodations } : { email: value, external: data.has("external"), ...accommodations });
    void job.run(async () => {
      const result = await request<Enrolled[]>(api + "/enrollments", "POST", { candidates });
      setCreated(result.data.filter((item) => item.temporaryPassword));
      form.reset();
    }, "Candidates enrolled. Each one has a personal activation key.");
  };
  const regenerate = () => void job.run(() => request(api + "/keys", "POST", { enrollmentIds: selected }), "New keys issued; the old ones no longer work.");
  const [reason, setReason] = useState("");
  const remove = () => void job.run(async () => {
    for (const enrollmentId of selected) await request(api + "/enrollments/remove", "POST", { enrollmentId, reason });
    setSelected([]); setReason("");
  }, "Removed. The candidates and administrators were notified with your reason.");
  const active = rows.filter((row) => row.key);
  const exportKeys = () => download(exam.title.replace(/[^a-z0-9]+/gi, "-") + "-keys.csv",
    "Name,Email,Activation key,Status\r\n" + rows.map((row) => [row.name, row.email, row.key ?? "", row.status].map(cell).join(",")).join("\r\n"));
  const copyKeys = () => void navigator.clipboard.writeText(active.map((row) => `${row.name}\t${row.email}\t${row.key}`).join("\n"))
    .then(() => job.run(async () => {}, "Keys copied to the clipboard."));
  return <div className="layout"><section className="panel keys-panel"><div className="section-row"><h2>Candidates and keys</h2>
    <div className="actions no-print">
      <button disabled={!active.length} onClick={copyKeys}>Copy keys</button>
      <button disabled={!rows.length} onClick={exportKeys}>Download CSV</button>
      <button disabled={!rows.length} onClick={() => window.print()}>Print</button>
      <button disabled={!selected.length || job.busy} onClick={regenerate}>Regenerate selected</button></div></div>
    {selected.length > 0 && <div className="compact remove-row no-print"><label>Reason for removing {selected.length} selected
      <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} placeholder="At least 10 characters, shared with the candidate" /></label>
      <button className="danger" disabled={job.busy || reason.trim().length < 10} onClick={remove}>Remove from exam</button></div>}
    <p className="muted no-print">Every enrolled candidate gets a personal key automatically. The key unlocks the exam and seeds that candidate&apos;s question order.</p>
    <Feedback error={job.error || keys.error} note={job.note} pending={keys.pending} />
    {exam.status !== "published" ? <p className="empty">Publish the exam to enrol candidates and issue keys.</p> :
    <DataTable headers={[
      <input key="all" type="checkbox" aria-label="Select all candidates" checked={rows.length > 0 && selected.length === rows.length}
        onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.enrollmentId) : [])} /> as unknown as string,
      "Candidate", "Activation key", "Key status"]} rows={rows.map((row) => [
      <input key="select" type="checkbox" aria-label={"Select " + row.name} checked={selected.includes(row.enrollmentId)}
        onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.enrollmentId] : current.filter((value) => value !== row.enrollmentId))} />,
      <span key="name">{row.name}{row.isExternal && <span className="pill external">External</span>}<small>{row.email}</small></span>,
      row.key ? <code key="key" className="key">{row.key}</code> : <span key="key" className="muted">{row.status === "used" ? "Used to start" : row.hint ? `…${row.hint}` : "—"}</span>,
      <span key="status"><Status value={row.status} />{row.failedTries ? <small>{row.failedTries} wrong {row.failedTries === 1 ? "try" : "tries"}</small> : null}</span>,
    ])} />}
    {created.length > 0 && <details open className="notice"><summary>New candidate accounts (share these temporary passwords now)</summary>
      <DataTable headers={["Email", "Temporary password", "Activation key"]} rows={created.map((item) => [
        <span key="email">{item.email}{item.isExternal && <span className="pill external">External</span>}</span>,
        <code key="pw">{item.temporaryPassword}</code>, <code key="key">{item.key ?? "—"}</code>])} /></details>}
  </section><section className="panel no-print"><h2>Enrol candidates</h2>
    <form onSubmit={enroll}><label>Candidate emails<textarea required name="people" placeholder={"student1@umt.edu.pk\nstudent2@umt.edu.pk"} />
      <small>One per line. Unknown emails get a candidate account and a temporary password.</small></label>
      <label className="check"><input type="checkbox" name="external" />Invite addresses outside the institution as external users</label>
      <label>Time multiplier<input type="number" name="multiplier" required min="1" max="2" step=".05" defaultValue="1" /></label>
      <label className="check"><input type="checkbox" name="paste" />Allow paste accommodation</label>
      <button className="primary" disabled={job.busy || exam.status !== "published"}>Enrol and issue keys</button></form>
      {exam.enrollments.length > 0 && <details><summary>Camera exception</summary><form onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void job.run(() => request(api + "/camera-exception", "POST", {
          enrollmentId: data.get("id"), enabled: data.get("enabled") === "yes", reason: data.get("reason"),
        }), "Camera accommodation updated.");
      }}><label>Candidate<select name="id">{exam.enrollments.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>Exception<select name="enabled"><option value="yes">Grant</option><option value="no">Remove</option></select></label>
        <label>Reason<input required minLength={3} name="reason" /></label><button disabled={job.busy}>Save exception</button></form></details>}
    </section></div>;
}
