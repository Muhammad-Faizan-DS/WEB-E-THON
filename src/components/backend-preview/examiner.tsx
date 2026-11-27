"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DataTable, Feedback, Heading, Navigation, Status, formatDate } from "./common";
import { request, useAction, useResource } from "./client";
import { QuestionBank } from "./question-bank";
import { ExamBuilder, type Exam, type ExamDetail } from "./exam-builder";
import { AnalyticsPanel, GradingPanel, MonitorPanel } from "./exam-operations";
import { RequestsPanel } from "./administrator";
import { AttemptWorkspace } from "./workspace";
import { isDesktop } from "./device";

const links: Array<[string, string]> = [["Exams", "/examiner"], ["Question bank", "/examiner/questions"], ["Re-attempt requests", "/examiner/requests"]];

export function Examiner({ section, examId, attemptId, tab, userId, name }: {
  section?: string; examId?: string; attemptId?: string; tab?: string; userId: string; name: string;
}) {
  if (examId && attemptId) return <AttemptWorkspace key={attemptId} attemptId={attemptId} userId={userId} name={name} back={"/examiner/exams/" + examId} sandbox />;
  const current = section === "questions" || section === "requests" ? "/examiner/" + section : "/examiner";
  return <><Navigation items={links} selected={current} />
    {section === "questions" ? <QuestionBank /> : section === "requests" ? <RequestsPanel admin={false} />
      : examId === "new" ? <ExamBuilder /> : examId ? <ManageExam key={examId} examId={examId} tab={tab} userId={userId} /> : <ExamList />}</>;
}

function ExamList() {
  const exams = useResource<Exam[]>("/api/exams");
  return <><Heading title="Examiner workspace" note="Build exams, monitor candidates, and publish results." action={<Link className="button primary" href="/examiner/exams/new">Create exam</Link>} />
    <Feedback error={exams.error} pending={exams.pending} />
    <section className="panel"><h2>Your exams</h2>
      <DataTable headers={["Exam", "Status", "Schedule", "Duration", "Actions"]} rows={(exams.data ?? []).map((exam) => [
        <strong key="title">{exam.title}</strong>, <Status key="status" value={exam.resultsPublished ? "results_published" : exam.status} />,
        <div key="dates">{formatDate(exam.startsAt)}<small>Closes {formatDate(exam.endsAt)}</small></div>,
        exam.durationMin + " min", <Link key="manage" href={"/examiner/exams/" + exam.id}>Manage exam</Link>,
      ])} />
    </section></>;
}

function ManageExam({ examId, tab, userId }: { examId: string; tab?: string; userId: string }) {
  const path = "/examiner/exams/" + examId;
  const api = "/api/exams/" + examId;
  const detail = useResource<ExamDetail>("/api/exams?id=" + examId);
  const checklist = useResource<{ canPublish: boolean; issues: string[] }>(api + "/checklist");
  const refresh = async () => { await Promise.all([detail.reload(), checklist.reload()]); };
  const action = useAction(refresh);
  const router = useRouter();
  const exam = detail.data;
  const current = ["settings", "candidates", "monitor", "grading", "analytics"].includes(tab ?? "") ? tab! : "settings";
  async function sandbox() {
    const result = await action.run(() => request<{ id: string; sessionId: string }>(api + "/attempts", "POST", { sandbox: true, deviceCheck: isDesktop() }), "Sandbox ready.");
    if (!result) return;
    sessionStorage.setItem(`secureexam:${userId}:${result.data.id}`, result.data.sessionId);
    router.push(path + "?attempt=" + result.data.id);
  }
  return <><Heading title={exam?.title ?? "Manage exam"} note={exam?.instructions} action={<Link href="/examiner" className="button">All exams</Link>} />
    <Feedback error={detail.error || action.error || checklist.error} pending={detail.pending} note={action.note} />
    {exam && <>
      <div className="section-row"><div className="actions"><Status value={exam.resultsPublished ? "results_published" : exam.status} /><span>{exam.durationMin} minutes · {exam.totalMarks} marks</span></div>
        <div className="actions"><button disabled={action.busy} onClick={() => void sandbox()}>Sandbox preview</button>
          {exam.status === "draft" ? <button className="primary" disabled={action.busy || !checklist.data?.canPublish}
            onClick={() => void action.run(() => request(api + "/publish", "POST"), "Exam published.")}>Publish exam</button>
            : !exam.frozenAt && <button disabled={action.busy} onClick={() => void action.run(() => request(api + "/unpublish", "POST"), "Exam returned to draft.")}>Unpublish</button>}</div></div>
      <Navigation items={[["Settings & blueprint", "settings"], ["Candidates & keys", "candidates"], ["Live monitor", "monitor"],
        ["Grading & results", "grading"], ["Analytics", "analytics"]].map(([label, key]) => [label, path + "?tab=" + key])} selected={path + "?tab=" + current} />
      {current === "settings" && <div className="layout"><ExamBuilder exam={exam} reload={refresh} /><aside className="panel"><h2>Publish checklist</h2>
        {checklist.data?.canPublish ? <p className="notice">Ready to publish.</p> : <ul>{checklist.data?.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
          <dl className="facts"><div><dt>Opens</dt><dd>{formatDate(exam.startsAt)}</dd></div><div><dt>Closes</dt><dd>{formatDate(exam.endsAt)}</dd></div></dl></aside></div>}
      {current === "candidates" && <Enrollments exam={exam} reload={detail.reload} />}
      {current === "monitor" && <MonitorPanel examId={examId} />}
      {current === "grading" && <GradingPanel exam={exam} reload={detail.reload} />}
      {current === "analytics" && <AnalyticsPanel examId={examId} />}
    </>}</>;
}

function Enrollments({ exam, reload }: { exam: ExamDetail; reload: () => Promise<void> }) {
  const job = useAction(reload);
  const [keys, setKeys] = useState<Array<{ enrollmentId: string; key: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const api = "/api/exams/" + exam.id;
  const enroll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const candidates = String(data.get("ids")).split(/[\s,]+/).filter(Boolean).map((candidateId) => ({
      candidateId, timeMultiplier: Number(data.get("multiplier")), allowPaste: data.has("paste"),
    }));
    void job.run(() => request(api + "/enrollments", "POST", { candidates }), "Candidates enrolled.");
  };
  function issue() {
    void job.run(async () => {
      const result = await request<typeof keys>(api + "/keys", "POST", { enrollmentIds: selected });
      setKeys(result.data);
    }, "Keys generated. Copy or download them now.");
  }
  function exportKeys() {
    const csv = "Enrollment ID,Activation key\r\n" + keys.map(({ enrollmentId, key }) => enrollmentId + "," + key).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "activation-keys.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  return <div className="layout"><section className="panel"><div className="section-row"><h2>Enrolled candidates</h2>
    <button disabled={!selected.length || job.busy} onClick={issue}>Generate keys</button></div>
    <Feedback error={job.error} note={job.note} />
    <DataTable headers={["Select", "Candidate", "Time", "Access"]} rows={exam.enrollments.map((item) => [
      <input key="select" type="checkbox" aria-label={"Select " + item.name} checked={selected.includes(item.id)}
        onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id))} />,
      <span key="name">{item.name}<small>{item.email}</small></span>, item.timeMultiplier + "×", <Status key="status" value={item.status} />,
    ])} />
    {keys.length > 0 && <details open><summary>New activation keys</summary><DataTable headers={["Candidate", "Key"]} rows={keys.map((item) => [
      exam.enrollments.find(({ id }) => id === item.enrollmentId)?.name ?? item.enrollmentId, <code key="key">{item.key}</code>,
    ])} /><div className="actions"><button onClick={exportKeys}>Download CSV</button><button onClick={() => window.print()}>Print</button></div></details>}
  </section><section className="panel"><h2>Enroll candidates</h2>
    <form onSubmit={enroll}><label>Candidate account IDs<textarea required name="ids" placeholder="Paste one candidate ID per line" /></label>
      <label>Time multiplier<input type="number" name="multiplier" required min="1" max="2" step=".05" defaultValue="1" /></label>
      <label className="check"><input type="checkbox" name="paste" />Allow paste accommodation</label>
      <button className="primary" disabled={job.busy || exam.status !== "published"}>Enroll candidates</button></form>
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
