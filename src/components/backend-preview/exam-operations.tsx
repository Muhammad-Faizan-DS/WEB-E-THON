"use client";

import { DataTable, Feedback, formatDate } from "./common";
import { request, useAction, useResource } from "./client";
import type { ExamDetail } from "./exam-builder";

export { MonitorPanel } from "./live-monitor";

type Grading = {
  published: boolean; windowEnded: boolean;
  blockers: { ungraded: number; unreviewed: number; inProgress: number; pendingRequests: number };
  attempts: Array<{ id: string; candidate: string; score: number | null; questions: Array<{
    qid: string; position: number; type: string; text: string; marks: number; response: string | string[] | null; awarded: number | null;
    feedback: string | null; editTimeline?: Array<{ at: string; chars: number }>; blockedPastes: Array<{ at: string; meta?: { chars?: number } }>;
  }> }>;
};
export function GradingPanel({ exam, reload }: { exam: ExamDetail; reload: () => Promise<void> }) {
  const api = "/api/exams/" + exam.id;
  const grade = useResource<Grading>(api + "/grading");
  const job = useAction(async () => { await Promise.all([grade.reload(), reload()]); });
  const data = grade.data;
  return <section className="panel"><div className="section-row"><h2>Grading and results</h2>
    <button className="primary" disabled={job.busy || data?.published || !data?.windowEnded || Object.values(data.blockers).some(Boolean)}
      onClick={() => void job.run(() => request(api + "/results/publish", "POST"), "Results published.")}>Publish results</button></div>
    <Feedback error={grade.error || job.error} pending={grade.pending} note={job.note} />
    {data && <><p className="muted">{data.published ? "Results are published." : data.windowEnded ? "Exam window closed." : "Results can be published after the exam window closes."}</p>
      <p>{data.blockers.ungraded} written to grade · {data.blockers.unreviewed} incidents to review · {data.blockers.inProgress} active · {data.blockers.pendingRequests} requests pending</p>
      {!data.attempts.length && <p className="empty">No candidate submissions yet.</p>}
      {data.attempts.map((attempt) => <details key={attempt.id}><summary>{attempt.candidate} · {attempt.score === null ? "Grading pending" : `${attempt.score} / ${exam.totalMarks}`}</summary>
        {attempt.questions.map((item) => <article className="panel" key={item.qid}><h3>{item.position}. {item.text}</h3>
          <p>{Array.isArray(item.response) ? item.response.join(", ") : item.response ?? "Unanswered"}</p><p>Awarded {item.awarded ?? "pending"} / {item.marks}</p>
          {item.type === "written" && <details><summary>Answer activity</summary>
            <DataTable headers={["Time", "Characters", "Activity"]} rows={[...(item.editTimeline ?? []).map((line) => [formatDate(line.at), line.chars, "Saved"]),
              ...item.blockedPastes.map((line) => [formatDate(line.at), line.meta?.chars ?? "—", "Paste blocked"])]} /></details>}
          {(data.published || item.type === "written") && <form className="compact" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const body = { marks: Number(form.get("marks")), feedback: form.get("feedback") };
            void job.run(() => data.published
              ? request(api + "/results/regrade", "POST", { ...body, attemptId: attempt.id, qid: item.qid, reason: form.get("reason") })
              : request(`/api/answers/${attempt.id}/${item.qid}/grade`, "PATCH", body), data.published ? "Result regraded." : "Marks saved.");
          }}><label>Marks<input required name="marks" type="number" step=".01" min="0" max={item.marks} defaultValue={item.awarded ?? ""} /></label>
            <label>Feedback<input name="feedback" defaultValue={item.feedback ?? ""} /></label>
            {data.published && <label>Regrade reason<input name="reason" required minLength={3} /></label>}<button disabled={job.busy}>{data.published ? "Regrade" : "Save marks"}</button></form>}
        </article>)}
      </details>)}</>}
  </section>;
}

type Histogram = Array<{ from: number; to: number; count: number }>;
type Summary = { count: number; mean: number | null; median: number | null; min: number | null; max: number | null; passRate: number | null; published: boolean; distribution: Histogram };
type Stats = Array<{ qid: string; text: string; facility: number | null; discrimination: number | null; skipped: number | null; mostChosenWrong: string | null; flags: string[] }>;
type Fairness = { simulations: number; naive: { distribution: Histogram }; blueprint: { distribution: Histogram }; basis?: string };
type Pair = { candidates: string[]; matchingWrongAnswers: number; questionsCompared: number; label: string };

function Histogram({ bins, label }: { bins: Histogram; label: string }) {
  const max = Math.max(1, ...bins.map(({ count }) => count));
  return <div className="charts" aria-label={label}>{bins.map((bin) => <div key={bin.from}><span>{bin.from}–{bin.to}%</span>
    <meter min={0} max={max} value={bin.count} aria-label={`${bin.from} to ${bin.to} percent`} /><span>{bin.count}</span></div>)}</div>;
}

export function AnalyticsPanel({ examId }: { examId: string }) {
  const api = "/api/exams/" + examId;
  const summary = useResource<Summary>(api + "/analytics");
  const items = useResource<Stats>(api + "/analytics/items");
  const fairness = useResource<Fairness>(api + "/analytics/fairness");
  const collusion = useResource<Pair[]>(api + "/analytics/collusion");
  const data = summary.data;
  return <div className="stack"><Feedback error={summary.error || items.error || fairness.error || collusion.error} pending={summary.pending} />
    <section className="panel"><div className="section-row"><h2>Exam analytics</h2><div className="actions">
      <a className="button" href={api + "/report/pdf"}>Summary PDF</a>{data?.published && <a className="button" href={api + "/analytics/export/moodle.csv"}>Moodle CSV</a>}</div></div>
      {data && <><p>{data.count} graded · Mean {data.mean ?? "—"} · Median {data.median ?? "—"} · Range {data.min ?? "—"}–{data.max ?? "—"} · Pass rate {data.passRate === null ? "—" : Math.round(data.passRate * 100) + "%"}</p>
        <Histogram bins={data.distribution} label="Score distribution" /></>}
    </section>
    <section className="panel"><h2>Item analysis</h2><DataTable headers={["Question", "Facility", "Discrimination", "Skipped", "Most-used wrong choice", "Review"]} rows={(items.data ?? []).map((row) => [
      row.text, row.facility ?? "—", row.discrimination ?? "—", row.skipped === null ? "—" : Math.round(row.skipped * 100) + "%",
      row.mostChosenWrong ?? "—", <span key="flags" className={row.flags.includes("Check answer key") ? "danger" : ""}>{row.flags.join(", ") || "—"}</span>,
    ])} /></section>
    <section className="panel"><h2>Paper fairness</h2>{fairness.data?.simulations ? <>
      <p>{fairness.data.simulations} simulations · {fairness.data.basis}</p><div className="grid">
        <div><h3>Blueprint sampling</h3><Histogram bins={fairness.data.blueprint.distribution} label="Blueprint difficulty" /></div>
        <div><h3>Naive random sampling</h3><Histogram bins={fairness.data.naive.distribution} label="Naive difficulty" /></div></div></> : <p className="empty">A valid blueprint and question pool are required.</p>}</section>
    <section className="panel"><h2>Answer-sharing review</h2><DataTable headers={["Candidates", "Matching wrong answers", "Compared", "Signal"]} rows={(collusion.data ?? []).map((row) => [
      row.candidates.join(" and "), row.matchingWrongAnswers, row.questionsCompared, row.label,
    ])} /></section>
  </div>;
}
