"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Feedback, Status, formatDate } from "./common";
import { request, useAction, useResource } from "./client";

type Tile = {
  enrollmentId: string; candidateId: string; name: string; email: string; isExternal: boolean; attemptId: string | null; status: string;
  position: number; total: number; seen: number; answered: number; openCount: number; lockedCount: number; openLimit: number | null;
  timeLeftSec: number | null; deadlineAt: string | null; submittedAt: string | null; lastHeartbeatAt: string | null;
  connection: "online" | "offline" | "inactive"; gapSeconds: number; timeCreditSec: number; inReviewPause: boolean;
  handRaisedAt: string | null; handMessage: string | null; keyLocked: boolean;
  incidents: { priority: number; review: number; low: number; unreviewed: number; total: number };
};
type Incident = { id: string; attemptId: string; candidate: string; priority: string; summary: string; reviewStatus: string; endedAt: string; note?: string };
type Monitor = {
  exam: { id: string; title: string; startsAt: string; endsAt: string; integrityMode: string };
  serverNow: string;
  summary: { enrolled: number; notStarted: number; inProgress: number; submitted: number; voided: number; offline: number; handsRaised: number; needsAttention: number };
  candidates: Tile[];
  incidents: Incident[];
  events: Array<{ id: string; incidentId: string; type: string; qid: string | null; questionNumber: number | null; at: string; meta?: { detail?: string; chars?: number } }>;
  frames: Array<{ id: string; eventId: string; seq: number }>;
  announcements: Array<{ id: string; message: string; createdAt: string; readCount: number; audience: number; target: string | null }>;
};
type Filter = "all" | "attention" | "offline" | "submitted";

const clock = (seconds: number | null) => seconds === null ? "—" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const needsAttention = (tile: Tile) => Boolean(tile.handRaisedAt) || tile.connection === "offline" || tile.incidents.unreviewed > 0 || tile.keyLocked;
const finished = (status: string) => ["submitted", "auto_submitted", "graded"].includes(status);

/**
 * Live monitor (PRD §5 phase 6): one screen. Candidate tiles with quiet badges, an "All candidates" menu,
 * a side panel that opens only for the selected candidate, and an alerts inbox that never moves the layout.
 */
export function MonitorPanel({ examId, readOnly = false }: { examId: string; readOnly?: boolean }) {
  const api = "/api/exams/" + examId;
  const monitor = useResource<Monitor>(api + "/monitor", 5_000);
  const job = useAction(monitor.reload);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const data = monitor.data;
  const tiles = useMemo(() => (data?.candidates ?? []).filter((tile) => filter === "all" ? true : filter === "attention" ? needsAttention(tile)
    : filter === "offline" ? tile.connection === "offline" : finished(tile.status)), [data, filter]);
  const current = data?.candidates.find((tile) => tile.enrollmentId === selected);

  if (!data) return <Feedback error={monitor.error} pending={monitor.pending} />;
  const { summary } = data;
  return <div className="monitor">
    <div className="monitor-bar">
      <dl className="monitor-counts">
        <div><dt>Enrolled</dt><dd>{summary.enrolled}</dd></div>
        <div><dt>Not started</dt><dd>{summary.notStarted}</dd></div>
        <div data-tone="live"><dt>In progress</dt><dd>{summary.inProgress}</dd></div>
        <div><dt>Submitted</dt><dd>{summary.submitted}</dd></div>
        <div data-tone={summary.voided ? "bad" : undefined}><dt>Voided</dt><dd>{summary.voided}</dd></div>
        <div data-tone={summary.needsAttention ? "warn" : undefined}><dt>Needs attention</dt><dd>{summary.needsAttention}</dd></div>
      </dl>
      <div className="actions">
        <span className="muted live-dot" aria-live="off">Live · updated {new Date(data.serverNow).toLocaleTimeString()}</span>
        {!readOnly && <div className="menu-wrap"><button aria-expanded={menu} onClick={() => setMenu((open) => !open)}>All candidates ▾</button>
          {menu && <AllCandidatesMenu api={api} exam={data.exam} onDone={(note) => { setMenu(false); void job.run(async () => {}, note); }} />}</div>}
      </div>
    </div>
    <div className="monitor-filters" role="tablist" aria-label="Filter candidates">
      {([["all", "All", summary.enrolled], ["attention", "Needs attention", summary.needsAttention], ["offline", "Offline", summary.offline],
        ["submitted", "Submitted", summary.submitted]] as const).map(([key, label, total]) =>
        <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>{label} <span className="count">{total}</span></button>)}
    </div>
    <div className="exam-status"><Feedback error={job.error || monitor.error} note={job.note} /></div>
    <div className="monitor-body">
      <section aria-label="Candidates" className="tile-grid">
        {!tiles.length && <p className="empty">{filter === "all" ? "No candidates are enrolled yet. Enrol them from Candidates & keys." : "Nobody matches this filter right now."}</p>}
        {tiles.map((tile) => <button key={tile.enrollmentId} className="tile" aria-pressed={tile.enrollmentId === selected}
          data-attention={needsAttention(tile)} onClick={() => setSelected(tile.enrollmentId === selected ? null : tile.enrollmentId)}>
          <span className="tile-head"><span className="conn" data-state={tile.connection} title={tile.connection} />
            <strong>{tile.name}</strong>{tile.handRaisedAt && <span className="badge hand" title={tile.handMessage ?? "Asked for help"}>✋</span>}</span>
          <span className="tile-status"><Status value={tile.status} />{tile.inReviewPause && <span className="badge warn">paused</span>}</span>
          {tile.total > 0 && <span className="progress" aria-label={`${tile.answered} of ${tile.total} answered`}>
            <span style={{ width: `${Math.round(tile.answered / tile.total * 100)}%` }} /></span>}
          <span className="tile-meta"><span>{tile.total ? `${tile.answered}/${tile.total} answered` : "Not started"}</span>
            <span>{tile.timeLeftSec !== null ? clock(tile.timeLeftSec) + " left" : tile.submittedAt ? "Done" : ""}</span></span>
          <span className="tile-badges">
            {tile.incidents.priority > 0 && <span className="badge bad">{tile.incidents.priority} priority</span>}
            {tile.incidents.review > 0 && <span className="badge warn">{tile.incidents.review} review</span>}
            {tile.gapSeconds > 0 && <span className="badge">{tile.gapSeconds}s offline</span>}
            {tile.keyLocked && <span className="badge bad">key locked</span>}
          </span>
        </button>)}
      </section>
      <aside className="monitor-side">
        {current ? <CandidatePanel tile={current} data={data} api={api} readOnly={readOnly} job={job} onClose={() => setSelected(null)} />
          : <AlertsInbox data={data} onOpen={setSelected} />}
      </aside>
    </div>
  </div>;
}

function AllCandidatesMenu({ api, exam, onDone }: { api: string; exam: Monitor["exam"]; onDone: (note: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<string>) {
    event.preventDefault();
    setBusy(true); setError("");
    try { onDone(await action(new FormData(event.currentTarget))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The request failed."); }
    finally { setBusy(false); }
  }
  return <div className="menu panel" role="dialog" aria-label="Actions for all candidates">
    {error && <p className="error" role="alert">{error}</p>}
    <form onSubmit={(event) => void run(event, async (data) => {
      await request(api + "/announcements", "POST", { message: data.get("message") });
      return "Announcement sent to every candidate.";
    })}><label>Announcement to everyone<textarea name="message" required maxLength={2000} rows={3} /></label>
      <button className="primary" disabled={busy}>Send to all</button></form>
    <form onSubmit={(event) => void run(event, async (data) => {
      const endsAt = new Date(Date.parse(exam.endsAt) + Number(data.get("minutes")) * 60_000).toISOString();
      await request("/api/exams", "PATCH", { id: exam.id, endsAt });
      return `Exam window now closes ${formatDate(endsAt)}.`;
    })}><label>Extend end time (minutes)<input name="minutes" type="number" min={1} max={240} defaultValue={10} required /></label>
      <small>Currently closes {formatDate(exam.endsAt)}. Active candidates keep their personal deadline up to the new end.</small>
      <button disabled={busy}>Extend window</button></form>
  </div>;
}

function AlertsInbox({ data, onOpen }: { data: Monitor; onOpen: (enrollmentId: string) => void }) {
  const alerts = data.candidates.flatMap((tile) => [
    ...(tile.handRaisedAt ? [{ key: tile.enrollmentId + "hand", tile, at: tile.handRaisedAt, text: `asked for help${tile.handMessage ? `: “${tile.handMessage}”` : ""}`, tone: "warn" }] : []),
    ...(tile.connection === "offline" ? [{ key: tile.enrollmentId + "off", tile, at: tile.lastHeartbeatAt, text: "lost connection", tone: "warn" }] : []),
    ...(tile.keyLocked ? [{ key: tile.enrollmentId + "key", tile, at: null, text: "locked their key after 5 wrong tries", tone: "bad" }] : []),
    ...data.incidents.filter((incident) => incident.reviewStatus === "unreviewed" && incident.attemptId === tile.attemptId).map((incident) => ({
      key: incident.id, tile, at: incident.endedAt, text: incident.summary, tone: incident.priority === "priority" ? "bad" : incident.priority === "review" ? "warn" : "" })),
  ]).sort((a, b) => Date.parse(b.at ?? "0") - Date.parse(a.at ?? "0"));
  return <section className="panel inbox"><h2>Alerts</h2><p className="muted">Signals for review, newest first. Nothing here is automatic.</p>
    {!alerts.length && <p className="empty">All quiet.</p>}
    <ul>{alerts.slice(0, 40).map((alert) => <li key={alert.key} data-tone={alert.tone}>
      <button className="link" onClick={() => onOpen(alert.tile.enrollmentId)}><strong>{alert.tile.name}</strong> {alert.text}</button>
      {alert.at && <small>{new Date(alert.at).toLocaleTimeString()}</small>}</li>)}</ul>
    <h3>Announcements</h3>
    {!data.announcements.length && <p className="empty">No announcements yet.</p>}
    <ul>{data.announcements.slice(0, 8).map((item) => <li key={item.id}><span>{item.target ? `To ${item.target}: ` : ""}{item.message}</span>
      <small>{item.readCount} of {item.audience} read · {new Date(item.createdAt).toLocaleTimeString()}</small></li>)}</ul>
  </section>;
}

function CandidatePanel({ tile, data, api, readOnly, job, onClose }: {
  tile: Tile; data: Monitor; api: string; readOnly: boolean; job: ReturnType<typeof useAction>; onClose: () => void;
}) {
  const incidents = data.incidents.filter((incident) => incident.attemptId === tile.attemptId);
  const active = tile.status === "in_progress";
  const attempt = "/api/attempts/" + tile.attemptId;
  const creditLeft = Math.max(0, tile.gapSeconds - tile.timeCreditSec);
  return <section className="panel candidate-panel" aria-label={`Candidate ${tile.name}`}>
    <div className="section-row"><div><h2>{tile.name}</h2><small>{tile.email}</small></div><button onClick={onClose} aria-label="Close candidate panel">✕</button></div>
    <dl className="facts">
      <div><dt>Status</dt><dd><Status value={tile.status} /></dd></div>
      <div><dt>Progress</dt><dd>{tile.answered}/{tile.total} answered · {tile.lockedCount} locked · {tile.openCount} open{tile.openLimit !== null ? ` (limit ${tile.openLimit})` : ""}</dd></div>
      <div><dt>Time left</dt><dd>{clock(tile.timeLeftSec)}</dd></div>
      <div><dt>Connection</dt><dd>{tile.connection} · {tile.gapSeconds}s offline measured by server{tile.timeCreditSec ? ` · ${tile.timeCreditSec}s credited` : ""}</dd></div>
      {tile.handRaisedAt && <div><dt>Asked for help</dt><dd>{tile.handMessage ?? "No note"} <small>{new Date(tile.handRaisedAt).toLocaleTimeString()}</small></dd></div>}
    </dl>
    {!readOnly && active && <div className="stack">
      <form className="compact" onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = new FormData(form).get("message");
        void job.run(async () => { await request(api + "/announcements", "POST", { message, candidateId: tile.candidateId }); form.reset(); }, `Private message sent to ${tile.name}.`);
      }}><label>Private message{tile.handRaisedAt ? " (answers their question)" : ""}<input name="message" required maxLength={2000} /></label><button className="primary" disabled={job.busy}>Send</button></form>
      <form className="compact" onSubmit={(event) => {
        event.preventDefault();
        const seconds = Number(new FormData(event.currentTarget).get("seconds"));
        void job.run(() => request(attempt + "/time-credit", "POST", { seconds }), `${seconds}s added for ${tile.name}.`);
      }}><label>Time credit (s)<input name="seconds" type="number" min={1} max={Math.max(1, creditLeft)} defaultValue={creditLeft || undefined} required /></label>
        <button disabled={job.busy || creditLeft < 1}>Grant</button><small>{creditLeft ? `Up to ${creditLeft}s, the offline time the server measured.` : "Only server-measured offline time can be credited."}</small></form>
      <form className="compact" onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get("limit"));
        void job.run(() => request(attempt + "/open-limit", "POST", { openLimit: value ? Number(value) : null, all: false }), "Open-question limit raised.");
      }}><label>Open-question limit<input name="limit" type="number" min={(tile.openLimit ?? 0) + 1} placeholder="Blank = unlimited" /></label>
        <button disabled={job.busy || tile.openLimit === null}>Raise</button></form>
    </div>}
    <h3>Integrity timeline</h3>
    {!incidents.length && <p className="empty">No signals recorded.</p>}
    {incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} data={data} readOnly={readOnly} job={job} />)}
  </section>;
}

function IncidentCard({ incident, data, readOnly, job }: { incident: Incident; data: Monitor; readOnly: boolean; job: ReturnType<typeof useAction> }) {
  const events = data.events.filter((event) => event.incidentId === incident.id);
  return <details className="incident" data-priority={incident.priority} open={incident.reviewStatus === "unreviewed"}>
    <summary><span className="badge" data-priority={incident.priority}>{incident.priority}</span> {incident.summary} <Status value={incident.reviewStatus} /></summary>
    <ol className="timeline">{events.map((item) => <li key={item.id}><time>{new Date(item.at).toLocaleTimeString()}</time>
      <span>{item.type.replaceAll("_", " ")}{item.questionNumber ? ` · Q${item.questionNumber}` : ""}{item.meta?.chars !== undefined ? ` · ${item.meta.chars} chars` : ""}{item.meta?.detail ? ` · ${item.meta.detail}` : ""}</span>
      {data.frames.filter((frame) => frame.eventId === item.id).length > 0 && <span className="frames">
        {data.frames.filter((frame) => frame.eventId === item.id).map((frame) => <Snapshot key={frame.id} id={frame.id} seq={frame.seq} />)}</span>}
    </li>)}</ol>
    {!readOnly && incident.reviewStatus === "unreviewed" && <form className="compact" onSubmit={(event) => {
      event.preventDefault();
      const detail = new FormData(event.currentTarget);
      const outcome = detail.get("outcome");
      const qid = detail.get("qid");
      void job.run(() => request("/api/incidents/" + incident.id, "PATCH", outcome === "clear"
        ? { status: "cleared", note: detail.get("note") } : { status: "confirmed", outcome, note: detail.get("note"), qid: qid || undefined }), "Incident reviewed.");
    }}><label>Decision<select name="outcome"><option value="clear">Cleared</option><option value="warning_only">Confirmed · warning only</option>
      <option value="zero_question">Confirmed · zero a question</option><option value="escalate_void">Confirmed · escalate to admin</option></select></label>
      <label>Question<select name="qid"><option value="">Only for zero</option>{[...new Map(events.filter((item) => item.qid).map((item) => [item.qid!, item.questionNumber])).entries()]
        .map(([id, number]) => <option key={id} value={id}>Question {number}</option>)}</select></label>
      <label>Note<input name="note" minLength={3} required /></label><button disabled={job.busy}>Save review</button></form>}
    {incident.note && <p className="muted">Reviewer note: {incident.note}</p>}
  </details>;
}

function Snapshot({ id, seq }: { id: string; seq: number }) {
  const [opened, setOpened] = useState(false);
  const frame = useResource<string>(opened ? "/api/incidents/frames/" + id : null);
  if (!opened) return <button className="frame-button" onClick={() => setOpened(true)}>Frame {seq}</button>;
  return <>{frame.error && <small className="error">{frame.error}</small>}{frame.data &&
    // eslint-disable-next-line @next/next/no-img-element
    <img width={160} height={120} src={frame.data} alt={`Camera frame ${seq} for this incident`} />}</>;
}
