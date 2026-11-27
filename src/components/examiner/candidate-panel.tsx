"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Clock3, Hand, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import type { MonitorRow } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { ExtendCreate, HELP_LABEL, MessageCreate, type Extension, type ProctorMessage } from "@/lib/client/proctor";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AnswerStrip } from "@/components/ui/answer-strip";
import { Status } from "@/components/ui/badge";
import { ContactIndicator, IncidentCounts } from "./severity";
import { cn, fmtClock, fmtTime } from "@/lib/utils";

const STATUS_LABEL: Record<MonitorRow["status"], { label: string; tone: "neutral" | "primary" | "warning" | "success" | "info" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "primary" },
  locked: { label: "Locked", tone: "warning" },
  submitted: { label: "Submitted", tone: "success" },
  expired: { label: "Time ended", tone: "info" },
};

/**
 * Everything an examiner can do for one candidate without leaving the monitor (the guide's
 * "no navigation, minimal popups"): status, open help requests, incidents, a private conversation,
 * reminders, and an audited time extension.
 */
export function CandidatePanel({
  examId, row, now, messages, extensions, open, onOpenChange, onChanged,
}: {
  examId: string; row: MonitorRow | null; now: number; messages: ProctorMessage[]; extensions: Extension[];
  open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  if (!row) return null;
  const s = STATUS_LABEL[row.status];
  const live = row.status === "in_progress" || row.status === "locked";
  const left = row.deadline && live ? Date.parse(row.deadline) - now : null;
  const thread = messages.filter((m) => m.attemptId === row.attemptId);
  const openHelp = thread.filter((m) => m.kind === "help" && !m.resolvedAt);
  const myExt = extensions.filter((x) => x.attemptId === row.attemptId || (x.attemptId === null && row.attemptId));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(30rem,100%)] gap-0 p-0">
        <div className="border-b px-5 pt-5 pb-4">
          <SheetTitle className="pr-8 text-lg font-semibold">{row.candidateName}</SheetTitle>
          <SheetDescription className="font-mono text-xs text-muted-foreground">{row.studentId ?? "No student ID"}</SheetDescription>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Status tone={s.tone}>{s.label}</Status>
            {left !== null && <span className="num inline-flex items-center gap-1.5 text-muted-foreground"><Clock3 className="size-3.5" aria-hidden />{fmtClock(left)} left</span>}
            <ContactIndicator contact={row.contact} lastAt={row.lastContactAt} now={now} />
          </div>
          {row.status !== "not_started" && (
            <div className="mt-3"><AnswerStrip total={row.total} answered={row.answered} state={row.status === "locked" ? "locked" : live ? "live" : "done"} label={`${row.answered} of ${row.total} answered`} />
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">{row.answered} of {row.total} answered · opens {row.opensUsed}/{row.maxOpens}</p></div>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {openHelp.length > 0 && (
            <section aria-labelledby="help-h" className="rounded-lg border border-flag/30 bg-flag-soft/60 p-3.5">
              <h3 id="help-h" className="flex items-center gap-2 text-sm font-semibold"><Hand className="size-4 text-flag" aria-hidden />Asking for help</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {openHelp.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-medium">{m.category ? HELP_LABEL[m.category] : "Help"}</span> · <span className="num text-muted-foreground">{fmtTime(m.createdAt, false)}</span>
                      <p className="prose-read mt-0.5 text-[15px]">“{m.body}”</p>
                    </div>
                    <ResolveHelp attemptId={row.attemptId!} msgId={m.id} onDone={onChanged} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Replying doesn&apos;t close a request; mark each one resolved when it&apos;s handled. A break never pauses the clock; add time if it&apos;s fair.</p>
            </section>
          )}

          <section aria-labelledby="inc-h">
            <div className="flex items-center justify-between gap-3">
              <h3 id="inc-h" className="text-sm font-semibold">Incidents</h3>
              {row.attemptId && <Button asChild size="sm" variant="ghost"><Link href={`/examiner/exams/${examId}/attempts/${row.attemptId}`}>Timeline <ArrowRight /></Link></Button>}
            </div>
            <div className="mt-1.5 flex items-center gap-3"><IncidentCounts c={row.incidents} />{row.unreviewed > 0 && <span className="text-xs text-muted-foreground">{row.unreviewed} to review</span>}</div>
          </section>

          {row.attemptId && <Conversation key={`conv-${row.attemptId}`} attemptId={row.attemptId} thread={thread} onSent={onChanged} />}
          {row.attemptId && live && <ExtendForm key={`ext-${row.attemptId}`} attemptId={row.attemptId} onDone={onChanged} />}

          {myExt.length > 0 && (
            <section aria-labelledby="ext-h">
              <h3 id="ext-h" className="text-sm font-semibold">Time added</h3>
              <ul className="mt-2 divide-y rounded-lg border text-sm">
                {myExt.map((x) => (
                  <li key={x.id} className="px-3 py-2"><span className="font-medium">+{x.minutes} min</span> {x.attemptId === null && <span className="text-muted-foreground">(everyone)</span>} · <span className="num text-muted-foreground">{fmtTime(x.at, false)}</span> · {x.by}<p className="text-muted-foreground">{x.reason}</p></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ResolveHelp({ attemptId, msgId, onDone }: { attemptId: string; msgId: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api.post(`/api/attempts/${attemptId}/help/${msgId}/resolve`); toast.success("Marked as resolved"); onDone(); }
      catch (e) { toast.error("Couldn't mark it resolved", { description: (e as ApiError).message }); }
      finally { setBusy(false); }
    }}>Mark resolved</Button>
  );
}

function Conversation({ attemptId, thread, onSent }: { attemptId: string; thread: ProctorMessage[]; onSent: () => void }) {
  const [body, setBody] = React.useState("");
  const [kind, setKind] = React.useState<"message" | "reminder">("message");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = MessageCreate.safeParse({ body, kind });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      await api.post(`/api/attempts/${attemptId}/messages`, parsed.data);
      setBody(""); setError(null);
      toast.success(kind === "reminder" ? "Reminder sent" : "Message sent", { description: "Only this candidate sees it." });
      onSent();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Couldn't send."); } finally { setPending(false); }
  }
  return (
    <section aria-labelledby="msg-h">
      <h3 id="msg-h" className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4 text-subtle-foreground" aria-hidden />Private messages</h3>
      {thread.length > 0 ? (
        <ol className="mt-2 space-y-2">
          {thread.map((m) => (
            <li key={m.id} className={cn("max-w-[90%] rounded-lg px-3 py-2 text-sm", m.from === "examiner" ? "ml-auto bg-primary-soft" : "bg-surface-2")}>
              <p className="text-[11px] text-muted-foreground">
                {m.from === "examiner" ? (m.kind === "reminder" ? "Reminder from you" : "You") : m.category ? HELP_LABEL[m.category] : "Candidate"} · <span className="num">{fmtTime(m.createdAt, false)}</span>
              </p>
              <p className="mt-0.5">{m.body}</p>
            </li>
          ))}
        </ol>
      ) : <p className="mt-1 text-sm text-muted-foreground">No messages yet.</p>}
      <form onSubmit={send} noValidate className="mt-3 space-y-2">
        <Label htmlFor="pm" className="sr-only">Message to this candidate</Label>
        <Textarea id="pm" rows={2} value={body} maxLength={500} onChange={(e) => { setBody(e.target.value); setError(null); }}
          placeholder={kind === "reminder" ? "e.g. Please stay on the exam page until you submit." : "e.g. Yes, you can use a calculator for Question 2."}
          aria-invalid={!!error} aria-describedby="pm-help" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Message type" className="flex gap-1 rounded-md border p-0.5 text-[13px]">
            {(["message", "reminder"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={cn("inline-flex min-h-8 items-center gap-1.5 rounded px-2.5 font-medium transition-colors duration-150", kind === k ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {k === "reminder" && <BellRing className="size-3.5" aria-hidden />}{k === "message" ? "Message" : "Reminder"}
              </button>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Send</Button>
        </div>
        <p id="pm-help" className={cn("text-xs", error ? "text-danger" : "text-muted-foreground")}>{error ?? "Reminders are neutral nudges, never accusations. Nothing here changes marks."}</p>
      </form>
    </section>
  );
}

function ExtendForm({ attemptId, onDone }: { attemptId: string; onDone: () => void }) {
  const [minutes, setMinutes] = React.useState(5);
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ExtendCreate.safeParse({ minutes, reason });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    setPending(true);
    try {
      await api.post(`/api/attempts/${attemptId}/extend`, parsed.data);
      setReason(""); setErrors({});
      toast.success(`Added ${minutes} min`, { description: "Recorded with your name. The candidate was told." });
      onDone();
    } catch (err) { setErrors({ form: err instanceof ApiError ? err.message : "Couldn't add time." }); } finally { setPending(false); }
  }
  return (
    <section aria-labelledby="extend-h">
      <h3 id="extend-h" className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-subtle-foreground" aria-hidden />Add time for this candidate</h3>
      <form onSubmit={submit} noValidate className="mt-2 grid gap-2 sm:grid-cols-[6rem_1fr]">
        <div>
          <Label htmlFor="ext-min" className="text-xs text-muted-foreground">Minutes</Label>
          <Input id="ext-min" type="number" min={1} max={60} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-invalid={!!errors.minutes} />
        </div>
        <div>
          <Label htmlFor="ext-why" className="text-xs text-muted-foreground">Reason (kept on record)</Label>
          <Input id="ext-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Arrived late: bus breakdown, verified" aria-invalid={!!errors.reason} />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className={cn("text-xs", Object.keys(errors).length ? "text-danger" : "text-muted-foreground")} aria-live="polite">{errors.minutes ?? errors.reason ?? errors.form ?? "Moves this candidate's deadline. Audited."}</p>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Clock3 />} Add {minutes || 0} min</Button>
        </div>
      </form>
    </section>
  );
}
