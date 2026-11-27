"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Role } from "@/lib/contracts/core";
import { DataTable, Feedback, Heading, Status, formatDate } from "./common";
import { request, useAction, useResource } from "./client";
import { MonitorPanel } from "./exam-operations";
import { DisputesPanel } from "./disputes";

type Account = { id: string; name: string; email: string; role: Role; active: boolean; isExternal: boolean; createdAt: string };
type Page = { items: Account[]; total: number; page: number; pageSize: number; pages: number };
type Audit = { id: string; actor: string; action: string; entity: string; entityId: string; reason?: string | null; at: string;
  before?: Record<string, unknown> | null; after?: Record<string, unknown> | null };
type Reattempt = { id: string; status: string; examinerNote: string | null; adminReason: string | null; exam: string; candidate: string; createdAt: string };
type Blocked = { id: string; exam: string; candidate: string; strikes: number };

export function Administrator({ section, examId, userId }: { section?: string; examId?: string; userId: string }) {
  return section === "requests" ? <RequestsPanel admin /> : section === "audit" ? <AuditPanel /> : section === "exams" ? <Oversight examId={examId} />
    : section === "disputes" ? <DisputesPanel role="admin" /> : <UsersPanel self={userId} />;
}

function Oversight({ examId }: { examId?: string }) {
  const exams = useResource<Array<{ id: string; title: string; status: string; resultsPublished: boolean }>>(examId ? null : "/api/exams");
  return <><Heading title="Exam oversight" note="Review exam activity and integrity incidents across examiners." />
    {examId ? <MonitorPanel examId={examId} readOnly /> : <section className="panel"><Feedback error={exams.error} pending={exams.pending} />
      <DataTable headers={["Exam", "Status", "Actions"]} rows={(exams.data ?? []).map((exam) => [
        exam.title, <Status key="status" value={exam.resultsPublished ? "results_published" : exam.status} />,
        <Link key="monitor" href={"/portal/admin/exams/" + exam.id}>View monitor</Link>,
      ])} /></section>}</>;
}

function RowMenu({ item, self, busy, onAction }: { item: Account; self: boolean; busy: boolean; onAction: (kind: "reset" | "toggle") => void }) {
  const [open, setOpen] = useState(false);
  return <div className="menu-wrap"><button aria-label={"Actions for " + item.name} aria-expanded={open} disabled={busy} onClick={() => setOpen((value) => !value)}>…</button>
    {open && <div className="menu row-menu" role="menu">
      <button role="menuitem" onClick={() => { setOpen(false); onAction("reset"); }}>Reset password</button>
      <button role="menuitem" className={item.active ? "danger" : ""} disabled={self} title={self ? "You cannot deactivate your own account" : undefined}
        onClick={() => { setOpen(false); onAction("toggle"); }}>{item.active ? "Deactivate" : "Reactivate"}</button>
    </div>}</div>;
}

function UsersPanel({ self }: { self: string }) {
  const [filters, setFilters] = useState({ role: "", q: "", page: 1 });
  const query = new URLSearchParams({ ...(filters.role ? { role: filters.role } : {}), ...(filters.q ? { q: filters.q } : {}), page: String(filters.page) });
  const accounts = useResource<Page>("/api/admin/users?" + query.toString());
  const job = useAction(accounts.reload);
  const [preview, setPreview] = useState<{ valid: Array<{ email: string }>; errors: Array<{ row: number; message: string }>; imported: number }>();
  const [issued, setIssued] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [search, setSearch] = useState("");
  const data = accounts.data;
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const input = { name: fields.get("name"), email: fields.get("email"), password: fields.get("password"), role: fields.get("role"), external: fields.has("external") };
    void job.run(async () => { await request("/api/admin/users", "POST", input); form.reset(); }, input.external ? "External user invited." : "Account created.");
  }
  function bulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const commit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "commit";
    void job.run(async () => {
      const file = data.get("file");
      const csv = file instanceof File && file.size ? await file.text() : String(data.get("csv"));
      const result = await request<NonNullable<typeof preview>>("/api/admin/users/import", "POST", { csv, commit });
      setPreview(result.data);
    }, commit ? "Valid accounts imported." : "Account import preview ready.");
  }
  function act(item: Account, kind: "reset" | "toggle") {
    if (kind === "reset") void job.run(async () => {
      const result = await request<{ email: string; temporaryPassword: string }>("/api/admin/users/" + item.id + "/reset-password", "POST");
      setIssued(result.data);
    }, "Temporary password issued.");
    else void job.run(() => request("/api/admin/users", "PATCH", { id: item.id, active: !item.active }), item.active ? "Account deactivated." : "Account reactivated.");
  }
  return <><Heading title="Users" note="Accounts come only from administrators, CSV import or examiner enrolment. There is no public sign-up." />
    <div className="exam-status"><Feedback error={accounts.error || job.error} note={job.note} /></div>
    <div className="layout"><section className="panel"><div className="section-row"><h2>User accounts</h2><span className="muted">{data ? `${data.total} accounts` : ""}</span></div>
      <div className="compact filters">
        <label>Role<select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value, page: 1 })}>
          <option value="">All roles</option><option value="candidate">Candidates</option><option value="examiner">Examiners</option><option value="admin">Administrators</option></select></label>
        <form className="compact" onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, q: search.trim(), page: 1 }); }}>
          <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></label><button>Search</button></form>
      </div>
      {issued && <p className="notice">Temporary password for {issued.email}: <code>{issued.temporaryPassword}</code> (shown once; share it securely) <button className="link small" onClick={() => setIssued(null)}>Dismiss</button></p>}
      {accounts.pending && <p className="muted">Loading…</p>}
      <DataTable headers={["User", "Role", "Access", ""]} rows={(data?.items ?? []).map((item) => {
        const mine = item.id === self;
        return [
          <div key="user"><strong>{item.name}</strong>{mine && <span className="pill">You</span>}{item.isExternal && <span className="pill external">External</span>}<small>{item.email}</small></div>,
          <select key="role" aria-label={"Role for " + item.name} value={item.role} disabled={job.busy || mine} title={mine ? "You cannot change your own role" : undefined}
            onChange={(event) => {
              const role = event.target.value;
              void job.run(() => request("/api/admin/users", "PATCH", { id: item.id, role }), "Role updated.");
            }}><option value="candidate">Candidate</option><option value="examiner">Examiner</option><option value="admin">Administrator</option></select>,
          <Status key="access" value={item.active ? "active" : "deactivated"} />,
          <RowMenu key="actions" item={item} self={mine} busy={job.busy} onAction={(kind) => act(item, kind)} />,
        ];
      })} />
      {data && data.pages > 1 && <div className="pager">
        <button disabled={data.page <= 1} onClick={() => setFilters({ ...filters, page: data.page - 1 })}>Previous</button>
        <span>Page {data.page} of {data.pages}</span>
        <button disabled={data.page >= data.pages} onClick={() => setFilters({ ...filters, page: data.page + 1 })}>Next</button></div>}
    </section><div className="stack"><section className="panel"><h2>Create or invite</h2><form onSubmit={create}>
      <label>Full name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label>
      <label>Temporary password<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label>
      <label>Role<select name="role"><option value="candidate">Candidate</option><option value="examiner">Examiner</option><option value="admin">Administrator</option></select></label>
      <label className="check"><input type="checkbox" name="external" />Invite external user (outside the institution&apos;s domains)</label>
      <button className="primary" disabled={job.busy}>Create account</button>
    </form></section><section className="panel"><h2>CSV import</h2><p className="muted">Columns: name, email, password, role, and optional external (true/false).</p>
      <form onSubmit={bulk}><label>CSV file<input name="file" type="file" accept=".csv" /></label><label>Or paste CSV<textarea name="csv" /></label>
        <div className="actions"><button value="preview" disabled={job.busy}>Preview</button><button value="commit" disabled={job.busy || !preview?.valid.length}>Import valid rows</button></div></form>
      {preview && <><p>{preview.valid.length} valid · {preview.imported} imported</p>
        <DataTable headers={["Row", "Issue"]} rows={preview.errors.map(({ row, message }) => [row, message])} /></>}
    </section></div></div>
  </>;
}

export function RequestsPanel({ admin }: { admin: boolean }) {
  const requests = useResource<Reattempt[]>("/api/requests");
  const blocked = useResource<Blocked[]>(admin ? "/api/admin/enrollments" : null);
  const job = useAction(async () => { await Promise.all([requests.reload(), blocked.reload()]); });
  return <><Heading title="Re-attempt requests" note={admin ? "Review escalated attempts and blocked enrollments." : "Review the candidate’s case and forward it to an administrator."} />
    <Feedback error={requests.error || blocked.error || job.error} pending={requests.pending} note={job.note} />
    <section className="panel"><h2>Requests</h2>
      <DataTable headers={["Candidate", "Exam", "Status", "Decision"]} rows={(requests.data ?? []).map((row) => [
        row.candidate, row.exam, <Status key="status" value={row.status} />,
        <div key="decision">{row.examinerNote && <p>Examiner note: {row.examinerNote}</p>}{row.adminReason && <p>Decision reason: {row.adminReason}</p>}
          {row.status === (admin ? "pending_admin" : "pending_examiner") && <form className="compact" onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
            void job.run(() => request("/api/requests", "PATCH", admin ? { id: row.id, action, reason: data.get("reason") }
              : { id: row.id, action: "forward", note: data.get("reason") }), admin ? "Decision recorded." : "Request forwarded.");
          }}><label>{admin ? "Reason" : "Review note"}<input required minLength={3} name="reason" /></label>
            {admin ? <><button disabled={job.busy} value="approve">Approve</button><button disabled={job.busy} value="reject">Reject</button></>
              : <button disabled={job.busy} value="forward">Forward to admin</button>}</form>}</div>,
      ])} />
    </section>
    {admin && <section className="panel"><h2>Blocked enrollments</h2>
      <DataTable headers={["Candidate", "Exam", "Strikes", "Unblock"]} rows={(blocked.data ?? []).map((row) => [
        row.candidate, row.exam, row.strikes, <form key="unblock" className="compact" onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget);
          void job.run(() => request("/api/admin/enrollments/" + row.id + "/unblock", "POST", { reason: input.get("reason") }), "Enrollment unblocked.");
        }}><label>Reason<input required minLength={3} name="reason" /></label><button disabled={job.busy}>Unblock candidate</button></form>,
      ])} /></section>}
  </>;
}

function auditDetail(row: Audit) {
  const after = row.after ?? {};
  const parts = [typeof after.message === "string" ? `“${after.message}”` : null, row.reason ?? null,
    typeof after.role === "string" && row.action === "role_changed" ? `→ ${after.role}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function AuditPanel() {
  const audit = useResource<Audit[]>("/api/audit", 15_000);
  return <><Heading title="Audit log" note="Every privileged action, including the text of messages examiners send." /><Feedback error={audit.error} pending={audit.pending} /><section className="panel">
    <DataTable headers={["Time", "Actor", "Action", "Details", "Record"]} rows={(audit.data ?? []).map((row) => [
      formatDate(row.at), row.actor, row.action.replaceAll("_", " "), <span key="detail" className="clamp">{auditDetail(row)}</span>,
      <span key="entity">{row.entity}<small>{row.entityId.slice(0, 8)}</small></span>,
    ])} /></section></>;
}
