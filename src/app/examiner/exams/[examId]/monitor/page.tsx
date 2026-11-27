"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight, Hand, Megaphone, Pause, Play, Radio, Search, Send, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AnnouncementCreate, ExamMonitor, ExamRequestList, type ExamRequest, type MonitorRow } from "@/contracts";
import { api, ApiError } from "@/lib/client/api";
import { useServerClock, useTick } from "@/lib/client/use-server-clock";
import { PhaseBadge } from "@/components/common/status";
import { ExamSubnav } from "@/components/examiner/exam-subnav";
import { ContactIndicator, IncidentCounts, NotEvidenceNote } from "@/components/examiner/severity";
import { RequestDecisionDialog, RequestTypeBadge } from "@/components/examiner/request-decision";
import { CandidatePanel } from "@/components/examiner/candidate-panel";
import { ExamActions } from "@/components/examiner/exam-actions";
import { openHelpByAttempt, ProctorState } from "@/lib/client/proctor";
import { Button } from "@/components/ui/button";
import { Badge, Status } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, StatStrip } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/misc";
import { AnswerStrip } from "@/components/ui/answer-strip";
import { cn, fmtAgo, fmtClock, fmtRelative, fmtTime } from "@/lib/utils";

type Filter = "attention" | "all" | "help" | "in_progress" | "offline" | "locked" | "submitted" | "ended" | "not_started";

const STATUS: Record<MonitorRow["status"], { label: string; tone: "neutral" | "primary" | "warning" | "success" | "info" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "primary" },
  locked: { label: "Locked", tone: "warning" },
  submitted: { label: "Submitted", tone: "success" },
  expired: { label: "Time ended", tone: "info" },
};

/** Attention score: higher = needs the examiner sooner. */
function attention(r: MonitorRow) {
  let s = 0;
  if (r.pendingRequest) s += 100;
  if (r.incidents.priority && r.unreviewed) s += 80;
  if (r.status === "locked") s += 60;
  if (r.contact === "lost") s += 40;
  if (r.unreviewed) s += 20;
  if (r.contact === "stale") s += 10;
  if (r.status === "in_progress") s += 1;
  return s;
}
const isOffline = (r: MonitorRow) => (r.status === "in_progress" || r.status === "locked") && (r.contact === "stale" || r.contact === "lost");

export default function MonitorPage() {
  const { examId } = useParams<{ examId: string }>();
  const clock = useServerClock();
  const [data, setData] = React.useState<ExamMonitor | null>(null);
  const [requests, setRequests] = React.useState<ExamRequest[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoad, setLastLoad] = React.useState<number | null>(null);
  const [paused, setPaused] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [deciding, setDeciding] = React.useState<ExamRequest | null>(null);
  const [proctor, setProctor] = React.useState<ProctorState | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  useTick(1000);

  const load = React.useCallback(async () => {
    const sent = Date.now();
    try {
      const [m, r] = await Promise.all([
        api.get(`/api/exams/${examId}/monitor`, ExamMonitor),
        api.get(`/api/exams/${examId}/requests`, ExamRequestList),
      ]);
      clock.sync(m.serverNow, sent);
      setData(m); setRequests(r.requests); setError(null); setLastLoad(clock.now());
      api.get(`/api/exams/${examId}/proctor`, ProctorState).then(setProctor, () => {});
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "This exam doesn't exist or isn't yours." : "Couldn't refresh. Retrying…");
    }
  }, [examId, clock]);

  React.useEffect(() => {
    const first = setTimeout(load, 0);
    if (paused) return () => clearTimeout(first);
    const t = setInterval(load, 5000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load, paused]);

  if (!data) {
    return error ? <Alert tone="danger">{error}</Alert> : (
      <div className="space-y-4"><Skeleton className="h-9 w-72" /><div className="grid grid-cols-3 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-96" /></div>
    );
  }

  const now = clock.now();
  const help = openHelpByAttempt(proctor?.messages ?? []);
  const helpCount = (r: MonitorRow) => (r.attemptId ? help[r.attemptId]?.length ?? 0 : 0);
  const score = (r: MonitorRow) => attention(r) + (helpCount(r) ? 90 : 0);
  const needsAttention = (r: MonitorRow) => score(r) >= 10;
  const pendingReqs = requests.filter((r) => r.status === "pending");
  const q = query.trim().toLowerCase();
  const rows = data.rows
    .filter((r) => !q || r.candidateName.toLowerCase().includes(q) || (r.studentId ?? "").toLowerCase().includes(q))
    .filter((r) => {
      switch (filter) {
        case "attention": return needsAttention(r);
        case "help": return helpCount(r) > 0;
        case "in_progress": return r.status === "in_progress";
        case "offline": return isOffline(r);
        case "locked": return r.status === "locked";
        case "submitted": return r.status === "submitted";
        case "ended": return r.status === "expired";
        case "not_started": return r.status === "not_started";
        default: return true;
      }
    })
    .sort((a, b) => score(b) - score(a) || a.candidateName.localeCompare(b.candidateName));

  const attentionCount = data.rows.filter(needsAttention).length;
  const closesIn = Date.parse(data.exam.closesAt) - now;
  const updatedAgo = lastLoad ? Math.max(0, Math.round((now - lastLoad) / 1000)) : null;

  const tiles = [
    { k: "all", label: "All enrolled", n: data.totals.enrolled },
    { k: "attention", label: "Needs attention", n: attentionCount },
    { k: "help", label: "Asking for help", n: data.rows.filter((r) => helpCount(r) > 0).length },
    { k: "in_progress", label: "In progress", n: data.totals.inProgress },
    { k: "offline", label: "Offline", n: data.rows.filter(isOffline).length },
    { k: "locked", label: "Locked", n: data.totals.locked },
    { k: "submitted", label: "Submitted", n: data.totals.submitted },
    { k: "ended", label: "Time ended", n: data.totals.expired },
    { k: "not_started", label: "Not started", n: data.totals.notStarted },
  ] as const;

  return (
    <>
      <ExamSubnav examId={examId} pendingRequests={data.pendingRequests} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold tracking-[-0.01em]">{data.exam.title}</h1>
            <PhaseBadge phase={data.exam.phase} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{data.exam.code}</span> · {data.exam.durationMin} min · {data.exam.questionCount} questions
            {data.exam.phase === "ongoing" && <> · closes {fmtRelative(closesIn)} ({fmtTime(data.exam.closesAt, false)})</>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="off">
          <span className="inline-flex items-center gap-1.5">
            <Radio className={cn("size-4", paused ? "text-muted-foreground" : "text-success")} aria-hidden />
            {paused ? "Paused" : error ? <span className="text-danger">{error}</span> : `Live · updated ${updatedAgo ?? 0} s ago`}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? <Play /> : <Pause />}{paused ? "Resume updates" : "Pause updates"}</Button>
        </div>
      </div>
      <div className="mb-6"><ExamActions examId={examId} live={data.exam.phase === "ongoing"} inProgress={data.totals.inProgress + data.totals.locked} onDone={load} /></div>

      <NotEvidenceNote className="mb-6 max-w-3xl" />

      <div role="group" aria-label="Filter candidates by status" className="mb-8">
        <StatStrip items={tiles.map((t) => ({ label: t.label, value: t.n, active: filter === t.k, onClick: () => setFilter(t.k), tone: (t.k === "attention" || t.k === "help") && t.n > 0 ? "text-danger" : undefined }))} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_22rem]">
        <section aria-labelledby="cands">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="cands" className="text-base font-semibold">Candidates <span className="text-sm font-normal text-muted-foreground">({rows.length}{filter !== "all" ? ` of ${data.rows.length}` : ""})</span></h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ID" className="pl-9" aria-label="Search candidates" />
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No candidates match this filter.</p>
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto rounded-lg border bg-surface md:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-surface-2 text-left text-[12px] text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Candidate</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Progress</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Contact</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Opens</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Incidents</th>
                      <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => (
                      <tr key={r.enrollmentId} className="align-middle transition-colors hover:bg-surface-2/60">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="flex items-center gap-2 font-medium">
                            {needsAttention(r) ? <span className="size-1.5 rounded-full bg-danger" aria-hidden /> : <span className="size-1.5" aria-hidden />}
                            {r.candidateName}{needsAttention(r) && <span className="sr-only"> (needs attention)</span>}
                          </p>
                          <p className="pl-3.5 font-mono text-xs text-muted-foreground">{r.studentId ?? "—"}</p>
                        </td>
                        <td className="px-3 py-3"><StatusCell r={r} now={now} help={helpCount(r)} onDecide={() => setDeciding(requests.find((x) => x.id === r.pendingRequest?.id) ?? null)} /></td>
                        <td className="w-40 px-3 py-3"><ProgressCell r={r} /></td>
                        <td className="whitespace-nowrap px-3 py-3"><ContactIndicator contact={r.contact} lastAt={r.lastContactAt} now={now} /></td>
                        <td className="num px-3 py-3"><span className={cn(r.opensUsed > r.maxOpens && "font-semibold text-warning")}>{r.attemptId ? `${r.opensUsed}/${r.maxOpens}` : "—"}</span></td>
                        <td className="px-3 py-3">
                          <IncidentCounts c={r.incidents} />
                          {r.unreviewed > 0 && <p className="mt-1 text-[12px] text-muted-foreground">{r.unreviewed} to review</p>}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {r.attemptId && <Button size="sm" variant={helpCount(r) ? "default" : "outline"} onClick={() => setSelected(r.enrollmentId)} aria-label={`Manage ${r.candidateName}`}>Manage</Button>}
                          {r.attemptId && <Button asChild size="sm" variant={r.unreviewed ? "default" : "ghost"} className="ml-1.5"><Link href={`/examiner/exams/${examId}/attempts/${r.attemptId}`}>Timeline <ArrowRight /></Link></Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* mobile cards */}
              <ul className="space-y-3 md:hidden">
                {rows.map((r) => (
                  <li key={r.enrollmentId} className="rounded-lg border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="flex items-center gap-2 font-medium">{needsAttention(r) && <span className="size-1.5 rounded-full bg-danger" aria-hidden />}{r.candidateName}</p><p className="font-mono text-xs text-muted-foreground">{r.studentId ?? "—"}</p></div>
                      <StatusCell r={r} now={now} help={helpCount(r)} onDecide={() => setDeciding(requests.find((x) => x.id === r.pendingRequest?.id) ?? null)} />
                    </div>
                    <div className="mt-3 space-y-2"><ProgressCell r={r} /><ContactIndicator contact={r.contact} lastAt={r.lastContactAt} now={now} /></div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <IncidentCounts c={r.incidents} />
                      <span className="flex gap-1.5">
                        {r.attemptId && <Button size="sm" variant={helpCount(r) ? "default" : "outline"} onClick={() => setSelected(r.enrollmentId)} aria-label={`Manage ${r.candidateName}`}>Manage</Button>}
                        {r.attemptId && <Button asChild size="sm" variant="outline"><Link href={`/examiner/exams/${examId}/attempts/${r.attemptId}`}>Timeline <ArrowRight /></Link></Button>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* decisions waiting come before the roster on narrower screens */}
        <aside className={cn("grid content-start gap-6 lg:grid-cols-2 2xl:grid-cols-1", pendingReqs.length > 0 && "order-first 2xl:order-none")}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2"><Hand className="size-4 text-subtle-foreground" aria-hidden />Requests {pendingReqs.length > 0 && <Badge tone="flag">{pendingReqs.length} pending</Badge>}</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingReqs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending unlock or re-attempt requests.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingReqs.map((r) => (
                    <li key={r.id} className="rounded-md bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-2"><p className="font-medium">{r.candidateName}</p><RequestTypeBadge type={r.type} /></div>
                      <p className="prose-read mt-1 line-clamp-2 text-[14px] text-foreground/85">“{r.reason}”</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{fmtAgo(now - Date.parse(r.createdAt))}</span>
                        <Button size="sm" onClick={() => setDeciding(r)}>Review</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/examiner/exams/${examId}/requests`} className="mt-3 inline-block text-sm text-primary hover:underline">All requests</Link>
            </CardContent>
          </Card>
          <AnnouncementsCard examId={examId} list={data.announcements} acks={proctor?.acks ?? {}} onSent={load} />
        </aside>
      </div>

      <CandidatePanel
        examId={examId}
        row={data.rows.find((r) => r.enrollmentId === selected) ?? null}
        now={now}
        messages={proctor?.messages ?? []}
        extensions={proctor?.extensions ?? []}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onChanged={load}
      />
      <RequestDecisionDialog request={deciding} open={!!deciding} onOpenChange={(o) => !o && setDeciding(null)} onDecided={load} />
    </>
  );
}

function StatusCell({ r, now, help, onDecide }: { r: MonitorRow; now: number; help: number; onDecide: () => void }) {
  const s = STATUS[r.status];
  const left = r.deadline && (r.status === "in_progress" || r.status === "locked") ? Date.parse(r.deadline) - now : null;
  return (
    <div className="flex flex-col items-start gap-1">
      <Status tone={s.tone} pulse={r.status === "in_progress" && r.contact === "live"}>{s.label}</Status>
      {left !== null && <span className="num pl-4 text-[12px] text-muted-foreground">{fmtClock(left)} left</span>}
      {r.finalizedAt && <span className="num pl-4 text-[12px] text-muted-foreground">at {fmtTime(r.finalizedAt, false)}</span>}
      {help > 0 && <span className="inline-flex items-center gap-1 pl-4 text-[12px] font-semibold text-flag"><Hand className="size-3.5" aria-hidden />Asking for help</span>}
      {r.pendingRequest && (
        <button type="button" onClick={onDecide} className="cursor-pointer pl-4 text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
          {r.pendingRequest.type === "unlock" ? "Unlock requested" : "Re-attempt requested"} · review
        </button>
      )}
    </div>
  );
}

function ProgressCell({ r }: { r: MonitorRow }) {
  if (r.status === "not_started") return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="space-y-1.5">
      <AnswerStrip total={r.total} answered={r.answered} state={r.status === "locked" ? "locked" : r.status === "in_progress" ? "live" : "done"} label={`${r.candidateName}: ${r.answered} of ${r.total} answered`} />
      <p className="text-xs text-muted-foreground tabular-nums">{r.answered} of {r.total} answered</p>
    </div>
  );
}

function AnnouncementsCard({ examId, list, acks, onSent }: { examId: string; list: ExamMonitor["announcements"]; acks: ProctorState["acks"]; onSent: () => void }) {
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = AnnouncementCreate.safeParse({ body });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      await api.post(`/api/exams/${examId}/announcements`, parsed.data);
      setBody(""); setError(null);
      toast.success("Announcement sent", { description: "Candidates see it within 15 seconds." });
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send.");
    } finally { setPending(false); }
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Megaphone className="size-4 text-subtle-foreground" aria-hidden />Announcements</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={send} className="space-y-2" noValidate>
          <Label htmlFor="ann" className="sr-only">Announcement to all candidates</Label>
          <Textarea id="ann" value={body} onChange={(e) => { setBody(e.target.value); setError(null); }} maxLength={500} rows={3}
            placeholder="e.g. Question 2 has a typo: “Classifcation” should read “Classification”." aria-invalid={!!error} aria-describedby="ann-help" />
          <div className="flex items-center justify-between gap-2">
            <p id="ann-help" className={cn("text-xs", error ? "text-danger" : "text-muted-foreground")}>{error ?? `${body.length}/500 · goes to everyone in this exam`}</p>
            <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Send</Button>
          </div>
        </form>
        {list.length > 0 && (
          <ol className="space-y-2 border-t pt-3">
            {[...list].reverse().map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-mono text-xs text-muted-foreground">{fmtTime(a.createdAt, false)}</span> <span>{a.body}</span>
                {acks[a.id] && acks[a.id].total > 0 && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      <span className={cn("font-medium", acks[a.id].acked === acks[a.id].total ? "text-success" : "text-foreground")}>{acks[a.id].acked} of {acks[a.id].total}</span> acknowledged
                    </summary>
                    {acks[a.id].missing.length > 0 ? <p className="mt-1">Not yet: {acks[a.id].missing.join(", ")}</p> : <p className="mt-1">Everyone who started has seen it.</p>}
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
