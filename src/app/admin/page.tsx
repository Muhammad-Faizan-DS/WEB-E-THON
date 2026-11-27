"use client";
import * as React from "react";
import { Copy, KeyRound, Search, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client/api";
import { AdminUser, AdminUsers, ResetResult, StatusReason } from "@/lib/client/admin";
import { useMe } from "@/lib/client/me";
import { PageHeader } from "@/components/common/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Status } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ROLES = [
  { key: "all", label: "Everyone" },
  { key: "candidate", label: "Candidates" },
  { key: "examiner", label: "Examiners" },
  { key: "admin", label: "Admins" },
] as const;
type RoleKey = (typeof ROLES)[number]["key"];

export default function AdminAccounts() {
  const { me } = useMe();
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState<RoleKey>("all");
  const [statusFor, setStatusFor] = React.useState<AdminUser | null>(null);
  const [resetFor, setResetFor] = React.useState<AdminUser | null>(null);

  const load = React.useCallback(() => {
    api.get("/api/admin/users", AdminUsers).then((d) => { setUsers(d.users); setError(null); }, (e: ApiError) => setError(e.message));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const shown = (users ?? []).filter((u) => (role === "all" || u.role === role) && (!q || `${u.name} ${u.email} ${u.studentId ?? ""}`.toLowerCase().includes(q)));
  const disabled = (users ?? []).filter((u) => !u.active).length;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Everyone who can sign in. Disable an account to block sign-in without deleting its records; reset a password to issue a one-time temporary one."
      />
      {error && <Alert tone="danger" title="Couldn't load accounts" className="mb-6">{error}</Alert>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-1">
          {ROLES.map((r) => {
            const n = r.key === "all" ? users?.length : users?.filter((u) => u.role === r.key).length;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={role === r.key}
                onClick={() => setRole(r.key)}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors", role === r.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")}
              >
                {r.label} <span className="num opacity-70">{n ?? "–"}</span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search name, email or student ID" placeholder="Search name, email or student ID" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      </div>
      {disabled > 0 && <p className="mb-3 text-[13px] text-muted-foreground">{disabled} account{disabled > 1 ? "s are" : " is"} disabled.</p>}

      {!users && !error ? (
        <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-surface">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_7rem_8rem_minmax(0,1fr)_15rem] gap-4 border-b bg-surface-2 px-4 py-2.5 text-[12px] font-medium text-muted-foreground md:grid">
            <span>Name</span><span>Role</span><span>Student ID</span><span>Status</span><span className="text-right">Actions</span>
          </div>
          <ul className="divide-y">
            {shown.map((u) => (
              <li key={u.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_7rem_8rem_minmax(0,1fr)_15rem] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.name}{u.id === me.id && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{u.email}</p>
                </div>
                <p className="text-[13px] capitalize"><span className="text-muted-foreground md:hidden">Role: </span>{u.role}</p>
                <p className="font-mono text-[12px] text-muted-foreground">{u.studentId ?? "—"}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <Status tone={u.active ? "success" : "neutral"}>{u.active ? "Active" : "Disabled"}</Status>
                  {u.tempPassword && <span className="text-muted-foreground">Temporary password issued</span>}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button variant="outline" size="sm" onClick={() => setResetFor(u)} disabled={u.id === me.id}><KeyRound /> Reset password</Button>
                  <Button variant="outline" size="sm" onClick={() => setStatusFor(u)} disabled={u.id === me.id}>
                    {u.active ? <><UserX /> Disable</> : <><UserCheck /> Re-enable</>}
                  </Button>
                </div>
              </li>
            ))}
            {users && shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No accounts match &ldquo;{query}&rdquo;.</li>}
          </ul>
        </div>
      )}

      <StatusDialog user={statusFor} onClose={() => setStatusFor(null)} onDone={(u) => { setUsers((s) => s?.map((x) => (x.id === u.id ? u : x)) ?? s); setStatusFor(null); }} />
      <ResetDialog user={resetFor} onClose={() => { setResetFor(null); load(); }} />
    </>
  );
}

function StatusDialog({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: (u: AdminUser) => void }) {
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const enabling = user ? !user.active : false;
  const submit = async () => {
    if (!user) return;
    const parsed = StatusReason.safeParse(reason);
    if (!parsed.success) { setErr(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const u = await api.post(`/api/admin/users/${user.id}/status`, { active: enabling, reason: parsed.data }, AdminUser);
      toast.success(enabling ? `${u.name} can sign in again` : `${u.name} can no longer sign in`);
      setReason(""); setErr(null); onDone(u);
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o && !busy) { setReason(""); setErr(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{enabling ? "Re-enable" : "Disable"} {user?.name}?</DialogTitle>
          <DialogDescription>
            {enabling ? "They will be able to sign in again." : "They won't be able to sign in. Their exams, answers and results stay on record."} The reason is written to the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="status-reason">Reason</Label>
          <Textarea id="status-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!err} aria-describedby={err ? "status-err" : undefined} />
          {err && <p id="status-err" role="alert" className="text-[13px] text-danger">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={enabling ? "default" : "danger"} onClick={submit} disabled={busy}>{enabling ? "Re-enable account" : "Disable account"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const [temp, setTemp] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const close = () => { if (busy) return; setTemp(null); setErr(null); onClose(); };
  const reset = async () => {
    if (!user) return;
    setBusy(true);
    try { setTemp((await api.post(`/api/admin/users/${user.id}/reset-password`, {}, ResetResult)).temporaryPassword); }
    catch (e) { setErr((e as ApiError).message); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user?.name}?</DialogTitle>
          <DialogDescription>Their current password stops working straight away. You get a temporary password to pass on privately; it is shown only once.</DialogDescription>
        </DialogHeader>
        {temp ? (
          <div className="rounded-lg border bg-surface-2 p-4">
            <p className="text-[13px] text-muted-foreground">Temporary password for {user?.email}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <code className="font-mono text-[20px] tracking-[0.08em]">{temp}</code>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(temp).then(() => toast.success("Copied"))}><Copy /> Copy</Button>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">This won&apos;t be shown again. The reset is in the audit log; the password itself is not.</p>
          </div>
        ) : err ? <Alert tone="danger">{err}</Alert> : null}
        <DialogFooter>
          {temp ? <Button onClick={close}>Done</Button> : (
            <>
              <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button onClick={reset} disabled={busy}><KeyRound /> Reset password</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
