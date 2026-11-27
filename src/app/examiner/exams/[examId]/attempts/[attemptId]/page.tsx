"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, Flag, Laptop, Loader2, MessageSquareText, Pencil, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AttemptTimeline, type IncidentDTO, type IncidentSeverity, type Observation } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { useServerClock, useTick } from "@/lib/client/use-server-clock";
import { CATEGORY, ContactIndicator, NotEvidenceNote, SEVERITY, SeverityBadge } from "@/components/examiner/severity";
import { Button } from "@/components/ui/button";
import { Badge, Status } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, StatStrip } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Progress, Skeleton } from "@/components/ui/misc";
import { cn, fmtAgo, fmtDuration, fmtTime } from "@/lib/utils";

type Filter = "all" | "open" | "priority" | "connectivity";

const OBS_LABEL: Record<string, string> = {
  visibility_hidden: "Exam page hidden", visibility_visible: "Exam page visible again", window_blur: "Window lost focus",
  window_focus: "Window focused again", fullscreen_exit: "Left fullscreen", fullscreen_enter: "Returned to fullscreen",
  paste: "Paste", copy_blocked: "Copy blocked", resize: "Window resized", offline: "Browser went offline", online: "Browser back online",
  mobile_detected: "Phone or tablet detected", face_absent_10s: "No face seen (10 s)", multiple_faces: "More than one face",
  session_opened: "Opened in another tab or device", session_superseded: "Older window replaced", heartbeat_gap: "No heartbeat",
};

function obsDetail(o: Observation) {
  const d = o.detail ?? {};
  if (o.type === "paste") return `${d.chars} characters · ${d.outcome === "blocked" ? "blocked by policy" : "allowed"}${d.position ? ` · Q${d.position}` : ""}`;
  if (o.type === "session_opened") return `open ${d.open} of ${d.max}`;
  if (o.type === "resize") return `${d.w}×${d.h}`;
  if (o.type === "heartbeat_gap") return `${d.seconds} s`;
  return "";
}

export default function TimelinePage() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
  const clock = useServerClock();
  const [data, setData] = React.useState<AttemptTimeline | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  useTick(5000);

  const load = React.useCallback(async () => {
    const sent = Date.now();
    try {
      const d = await api.get(`/api/attempts/${attemptId}/incidents`, AttemptTimeline);
      clock.sync(d.serverNow, sent);
      setData(d); setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "This attempt doesn't exist or isn't in one of your exams." : "Couldn't load the timeline.");
    }
  }, [attemptId, clock]);

  React.useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 10000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const back = <Link href={`/examiner/exams/${examId}/monitor`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Live monitor</Link>;
  if (error && !data) return <>{back}<Alert tone="danger">{error}</Alert></>;
  if (!data) return <>{back}<div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div></>;

  const a = data.attempt;
  const now = clock.now();
  const live = a.status === "in_progress" || a.status === "locked";
  const counts = { priority: 0, review: 0, info: 0 } as Record<IncidentSeverity, number>;
  data.incidents.forEach((i) => counts[i.severity]++);
  const open = data.incidents.filter((i) => i.severity !== "info" && !i.review);
  const shown = data.incidents.filter((i) =>
    filter === "open" ? i.severity !== "info" && !i.review : filter === "priority" ? i.severity === "priority" : filter === "connectivity" ? i.category === "connectivity" : true,
  );

  return (
    <>
      {back}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{a.examTitle}</p>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em]">{a.candidateName}</h1>
          <p className="font-mono text-xs text-muted-foreground">{a.studentId ?? ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Status tone={a.status === "in_progress" ? "primary" : a.status === "locked" ? "warning" : "success"} className="capitalize">{a.status.replace("_", " ")}</Status>
          {live && <ContactIndicator contact={a.lastContactAt && now - Date.parse(a.lastContactAt) < 30000 ? "live" : a.lastContactAt && now - Date.parse(a.lastContactAt) < 90000 ? "stale" : "lost"} lastAt={a.lastContactAt} now={now} />}
        </div>
      </div>

      <StatStrip className="mb-6" items={[
        { label: "Progress", value: `${a.answered} of ${a.total}`, hint: <Progress value={(a.answered / Math.max(1, a.total)) * 100} label="Answered" className="mt-1.5" /> },
        { label: "Started", value: fmtTime(a.startedAt, false) },
        { label: a.finalizedAt ? "Finished" : "Deadline", value: fmtTime(a.finalizedAt ?? a.deadline, false) },
        { label: "Tabs or devices", value: `${data.sessions.length} of ${data.maxOpens}`, tone: data.sessions.length > data.maxOpens ? "text-warning" : undefined },
      ]} />

      <NotEvidenceNote className="mb-8 max-w-3xl" />

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <section aria-labelledby="tl-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="tl-title" className="text-base font-semibold">Incident timeline</h2>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter incidents">
              {([["all", `All ${data.incidents.length}`], ["open", `To review ${open.length}`], ["priority", `Priority ${counts.priority}`], ["connectivity", "Connection"]] as const).map(([k, l]) => (
                <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)} aria-pressed={filter === k}>{l}</Button>
              ))}
            </div>
          </div>

          {data.incidents.length === 0 ? (
            <div className="grid place-items-center rounded-lg border border-dashed p-12 text-center">
              <ShieldCheck className="size-8 text-success" aria-hidden />
              <p className="mt-2 font-medium">Nothing observed</p>
              <p className="text-sm text-muted-foreground">No absences, pastes or connection drops have been recorded for this attempt.</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No incidents match this filter.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border-strong pl-6">
              {shown.map((i) => <IncidentItem key={i.key} i={i} attemptId={attemptId} onSaved={load} now={now} />)}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(["priority", "review", "info"] as const).map((s) => (
                  <li key={s} className="flex items-center justify-between"><SeverityBadge severity={s} /><span className="font-semibold tabular-nums">{counts[s]}</span></li>
                ))}
              </ul>
              <p className="mt-3 text-sm">{open.length ? <><b>{open.length}</b> incident{open.length > 1 ? "s" : ""} still need{open.length === 1 ? "s" : ""} a decision.</> : <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" aria-hidden />All reviewed</span>}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Laptop className="size-4" aria-hidden />Tabs &amp; devices</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {data.sessions.map((s, n) => (
                  <li key={n} className="flex items-start justify-between gap-2">
                    <span><span className="font-medium">Open {n + 1}</span> · {fmtTime(s.openedAt, false)}<br /><span className="text-xs text-muted-foreground">{s.userAgent.length > 48 ? s.userAgent.slice(0, 48) + "…" : s.userAgent}</span></span>
                    {s.active && <Badge tone="success">Active</Badge>}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">A same-tab refresh is not a new open.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle>How incidents are formed</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Overlapping signals (page hidden, focus lost, fullscreen exit) are merged into one absence so one action isn&apos;t counted three times.</p>
              <p>A paste within 10 s of returning is attached to that absence. Absence of 5 s or more plus a paste is <b className="text-foreground">Priority</b>; three Review incidents within 10 min also become Priority.</p>
              <p>Connection drops are tracked separately and are never more than Info.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function IncidentItem({ i, attemptId, onSaved, now }: { i: IncidentDTO; attemptId: string; onSaved: () => void; now: number }) {
  const [editing, setEditing] = React.useState<"dismissed" | "follow_up" | null>(null);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const Cat = CATEGORY[i.category];
  const sev = SEVERITY[i.severity];

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/attempts/${attemptId}/incidents/${encodeURIComponent(i.key)}/review`, { decision: editing, note });
      toast.success(editing === "dismissed" ? "Incident dismissed" : "Marked for follow-up");
      setEditing(null); setNote("");
      onSaved();
    } catch (e) {
      toast.error("Couldn't save the review", { description: e instanceof ApiError ? e.message : undefined });
    } finally { setSaving(false); }
  }

  return (
    <li className="relative">
      <span className={cn("absolute -left-[30px] top-5 size-3 rounded-full ring-4 ring-background", sev.dot)} aria-hidden />
      <article className={cn("rounded-lg border bg-surface", i.severity === "priority" && !i.review && "border-danger/40 shadow-md")} aria-label={`${sev.label}: ${Cat.label} at ${fmtTime(i.startedAt)}`}>
        <header className="flex flex-wrap items-center gap-2.5 px-5 pt-4">
          <SeverityBadge severity={i.severity} />
          <span className="inline-flex items-center gap-1.5 text-sm font-medium"><Cat.icon className="size-4 text-muted-foreground" aria-hidden />{Cat.label}</span>
          {i.questionPosition && <Badge tone="neutral">Question {i.questionPosition}</Badge>}
          <span className="num ml-auto text-[12px] text-muted-foreground">
            {fmtTime(i.startedAt)}{i.endedAt && i.endedAt !== i.startedAt ? `–${fmtTime(i.endedAt)}` : ""}
            {i.durationSec ? ` · ${fmtDuration(i.durationSec)}` : i.endedAt === null ? " · end unknown" : ""}
          </span>
        </header>
        <div className="space-y-3 px-5 py-3">
          <p className="prose-read text-[15.5px] text-foreground">{i.explanation}</p>
          <p className="text-[12px] text-muted-foreground">{i.groupingReason}</p>
          <details className="group rounded-md bg-surface-2">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              {i.observations.length} raw observation{i.observations.length > 1 ? "s" : ""}
            </summary>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th scope="col" className="py-1 pr-3 font-medium">Observed</th><th scope="col" className="py-1 pr-3 font-medium">What</th><th scope="col" className="py-1 pr-3 font-medium">Detail</th><th scope="col" className="py-1 font-medium">Received</th></tr></thead>
                <tbody>
                  {i.observations.map((o) => {
                    const delay = Math.round((Date.parse(o.serverTime) - Date.parse(o.clientTime)) / 1000);
                    return (
                      <tr key={o.id} className="border-t border-border/60">
                        <td className="py-1.5 pr-3 font-mono text-xs">{fmtTime(o.clientTime)}</td>
                        <td className="py-1.5 pr-3">{OBS_LABEL[o.type] ?? o.type}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{obsDetail(o)}</td>
                        <td className={cn("py-1.5 text-xs", delay > 10 ? "font-medium text-warning" : "text-muted-foreground")}>{delay > 10 ? `${delay} s later` : "on time"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </div>
        <footer className="border-t px-5 py-3">
          {i.review && !editing ? (
            <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <div>
                <Badge tone={i.review.decision === "dismissed" ? "success" : "flag"}>
                  {i.review.decision === "dismissed" ? <CheckCircle2 aria-hidden /> : <Flag aria-hidden />}
                  {i.review.decision === "dismissed" ? "Dismissed" : "Follow-up requested"}
                </Badge>
                <span className="ml-2 text-muted-foreground">by {i.review.reviewer} · {fmtAgo(now - Date.parse(i.review.reviewedAt))}</span>
                {i.review.note && <p className="mt-1.5 flex gap-1.5"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{i.review.note}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(i.review!.decision); setNote(i.review!.note); }}><Pencil /> Change</Button>
            </div>
          ) : editing ? (
            <div className="space-y-2">
              <Label htmlFor={`note-${i.key}`}>{editing === "dismissed" ? "Why is this fine? (optional)" : "What should happen next?"}</Label>
              <Textarea id={`note-${i.key}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                placeholder={editing === "dismissed" ? "e.g. Candidate said a notification popped up; returned quickly." : "e.g. Ask the candidate about the paste on Q3 after the exam."} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />}Save decision</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={saving}><Undo2 /> Cancel</Button>
              </div>
              <p className="text-xs text-muted-foreground">Recorded with your name and the time. It never changes the candidate&apos;s marks.</p>
            </div>
          ) : (
            i.severity === "info" ? (
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                <span>Info only. No decision needed.</span>
                <Button size="sm" variant="link" className="text-[12px]" onClick={() => setEditing("follow_up")}>Flag anyway</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing("dismissed")}><CheckCircle2 /> Dismiss</Button>
                <Button size="sm" variant="flag" onClick={() => setEditing("follow_up")}><Flag /> Request follow-up</Button>
              </div>
            )
          )}
        </footer>
      </article>
    </li>
  );
}
