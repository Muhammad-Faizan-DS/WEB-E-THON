"use client";

import { useState, type FormEvent } from "react";
import { Feedback, Heading, Status, formatDate } from "./common";
import { request, useAction, useResource } from "./client";

type Dispute = { id: string; category: string; subject: string; body: string; aboutExaminer: boolean; status: string; response: string | null;
  createdAt: string; updatedAt: string; examId: string | null; exam: string | null; candidate: string; candidateEmail: string; examiner: string | null };
type ExamOption = { id: string; title: string };
type Buckets = { available: ExamOption[]; upcoming: ExamOption[]; completed: ExamOption[] };

const categories = [["grading", "Grading or marks"], ["conduct", "Conduct of the exam or a person"], ["technical", "Technical problem"],
  ["accommodation", "Accommodation"], ["other", "Something else"]] as const;

/** Disputes for all three roles: candidates file and track; examiners and administrators answer the ones routed to them. */
export function DisputesPanel({ role }: { role: "candidate" | "examiner" | "admin" }) {
  const list = useResource<Dispute[]>("/api/disputes", 20_000);
  const exams = useResource<Buckets>(role === "candidate" ? "/api/candidate/exams" : null);
  const job = useAction(list.reload);
  const [open, setOpen] = useState<string | null>(null);
  const options = exams.data ? [...exams.data.available, ...exams.data.upcoming, ...exams.data.completed] : [];
  function file(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void job.run(async () => {
      await request("/api/disputes", "POST", { examId: data.get("examId") || undefined, category: data.get("category"),
        subject: data.get("subject"), body: data.get("body"), aboutExaminer: data.has("aboutExaminer") });
      form.reset();
    }, "Dispute sent. You'll get a notification when it is answered.");
  }
  const note = role === "candidate" ? "Raise a concern about grading, conduct or a technical problem. It goes to your examiner and the administrators."
    : role === "examiner" ? "Disputes from candidates in your exams. Disputes about examiners go to administrators only."
      : "Every dispute, including those that concern an examiner. Administrators are notified of all of them.";
  return <><Heading title="Disputes" note={note} />
    <div className="exam-status"><Feedback error={list.error || job.error} note={job.note} /></div>
    <div className={role === "candidate" ? "layout" : ""}>
      <section className="panel"><h2>{role === "candidate" ? "My disputes" : "Inbox"}</h2>
        {list.pending && <p className="muted">Loading…</p>}
        {list.data?.length === 0 && <p className="empty">{role === "candidate" ? "You haven't raised a dispute." : "No disputes need attention."}</p>}
        <ul className="dispute-list">{list.data?.map((item) => <li key={item.id}>
          <button className="link dispute-head" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
            <span><strong>{item.subject}</strong><small>{item.exam ?? "No exam"} · {categories.find(([key]) => key === item.category)?.[1] ?? item.category}
              {role !== "candidate" ? ` · ${item.candidate}` : ""} · {formatDate(item.createdAt)}</small></span>
            <span className="dispute-tags">{item.aboutExaminer && <span className="badge warn">About examiner</span>}<Status value={item.status} /></span></button>
          {open === item.id && <div className="dispute-body">
            <p>{item.body}</p>
            {role !== "candidate" && <p className="muted small">From {item.candidate} ({item.candidateEmail}){item.examiner ? ` · Examiner: ${item.examiner}` : ""}</p>}
            {item.response && <div className="notice"><strong>Response:</strong> {item.response}</div>}
            {role !== "candidate" && item.status !== "resolved" && item.status !== "rejected" && <form className="compact" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void job.run(() => request("/api/disputes/" + item.id, "PATCH", { status: data.get("status"), response: data.get("response") }), "Response sent to the candidate.");
            }}><label>Response<input name="response" required minLength={3} maxLength={4000} /></label>
              <label>Outcome<select name="status" defaultValue="resolved"><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label>
              <button className="primary" disabled={job.busy}>Send</button></form>}
          </div>}
        </li>)}</ul>
      </section>
      {role === "candidate" && <section className="panel"><h2>Raise a dispute</h2><form onSubmit={file}>
        <label>Exam<select name="examId"><option value="">Not about a specific exam</option>{options.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label>
        <label>Category<select name="category">{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Subject<input name="subject" required minLength={3} maxLength={150} /></label>
        <label>What happened<textarea name="body" required minLength={10} maxLength={4000} rows={5} /></label>
        <label className="check"><input type="checkbox" name="aboutExaminer" />This concerns my examiner. Send it to administrators only.</label>
        <button className="primary" disabled={job.busy}>Send dispute</button>
      </form></section>}
    </div>
  </>;
}
