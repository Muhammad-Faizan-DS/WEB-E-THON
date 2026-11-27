"use client";
import * as React from "react";
import { AlertTriangle, CheckCircle2, Flag, Loader2, NotebookPen, Save, Wifi } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client/api";
import { ISSUE_LABEL, IssueCategory, IssueCreate, IssueList, ProctorState, type Issue } from "@/lib/client/proctor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { cn, fmtTime } from "@/lib/utils";

/**
 * "Before you start" for examiners (from the exam-portal guide's proctor dashboard): a connectivity
 * test, examiner-only notes beside the candidate instructions, and a way to report an issue.
 */
export function PreExamChecklist({ examId }: { examId: string }) {
  const [state, setState] = React.useState<ProctorState | null>(null);
  React.useEffect(() => {
    api.get(`/api/exams/${examId}/proctor`, ProctorState).then(setState, () => setState(null));
  }, [examId]);
  return (
    <section aria-labelledby="before-h" className="mt-10">
      <h2 id="before-h" className="text-base font-semibold">Before you start</h2>
      <p className="mt-1 text-sm text-muted-foreground">Check your connection, keep your own notes next to what candidates read, and report anything that needs attention.</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <ConnectivityTest />
        <ReportIssue examId={examId} />
        <div className="rounded-lg border bg-surface p-5 lg:col-span-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">What candidates read</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Shown on the entry page before they start.</p>
              <div className="prose-read mt-3 max-h-56 overflow-y-auto rounded-md bg-surface-2 p-4 text-[15px] whitespace-pre-line">{state ? state.instructions : "Loading…"}</div>
            </div>
            {state && <ExaminerNotes examId={examId} initial={state.notes} />}
          </div>
        </div>
      </div>
    </section>
  );
}

type Verdict = { level: "good" | "slow" | "poor"; median: number; worst: number; failed: number };

function ConnectivityTest() {
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<Verdict | null>(null);
  async function run() {
    setRunning(true); setResult(null);
    const times: number[] = []; let failed = 0;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      try { await api.get("/api/ping"); times.push(performance.now() - t0); } catch { failed++; }
    }
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : Infinity;
    const worst = sorted.at(-1) ?? Infinity;
    const level: Verdict["level"] = failed > 1 || median > 1000 ? "poor" : median > 300 || failed === 1 ? "slow" : "good";
    setResult({ level, median, worst, failed });
    setRunning(false);
  }
  const copy = {
    good: { icon: CheckCircle2, cls: "text-success", label: "Good connection", hint: "Live monitoring will keep up." },
    slow: { icon: AlertTriangle, cls: "text-warning", label: "Slow connection", hint: "The monitor may lag a few seconds. Candidates aren't affected." },
    poor: { icon: AlertTriangle, cls: "text-danger", label: "Poor connection", hint: "Move closer to the router or switch networks before the exam opens." },
  } as const;
  return (
    <div className="rounded-lg border bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Wifi className="size-4 text-subtle-foreground" aria-hidden />Connectivity test</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Five round trips to the server from this device.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" onClick={run} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Wifi />} {result ? "Run again" : "Run test"}</Button>
        <p aria-live="polite" className="text-sm">
          {running && "Testing…"}
          {result && (() => {
            const c = copy[result.level]; const Icon = c.icon;
            return (
              <span className="inline-flex flex-col">
                <span className="inline-flex items-center gap-1.5 font-medium"><Icon className={cn("size-4", c.cls)} aria-hidden />{c.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Number.isFinite(result.median) ? `${Math.round(result.median)} ms typical, ${Math.round(result.worst)} ms worst` : "No response"}{result.failed ? ` · ${result.failed} of 5 failed` : ""}. {c.hint}
                </span>
              </span>
            );
          })()}
        </p>
      </div>
    </div>
  );
}

function ExaminerNotes({ examId, initial }: { examId: string; initial: string }) {
  const [notes, setNotes] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  async function save() {
    setPending(true);
    try { await api.put(`/api/exams/${examId}/notes`, { notes }); setSaved(notes); toast.success("Notes saved"); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Couldn't save notes."); }
    finally { setPending(false); }
  }
  return (
    <div>
      <Label htmlFor="ex-notes" className="flex items-center gap-2 text-sm font-semibold"><NotebookPen className="size-4 text-subtle-foreground" aria-hidden />Instructions for examiners</Label>
      <p className="mt-0.5 text-xs text-muted-foreground">Only examiners see these, for example what to allow and when to add time.</p>
      <Textarea id="ex-notes" rows={6} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-3"
        placeholder={"e.g. Calculators allowed for Q2.\nLate arrivals within 10 min: add the minutes they missed.\nPower cut in Lab 3: add time for everyone."} />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">{notes === saved ? "Saved" : "Unsaved changes"}</p>
        <Button size="sm" variant="outline" onClick={save} disabled={pending || notes === saved}>{pending ? <Loader2 className="animate-spin" /> : <Save />} Save notes</Button>
      </div>
    </div>
  );
}

function ReportIssue({ examId }: { examId: string }) {
  const [open, setOpen] = React.useState(false);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const load = React.useCallback(() => {
    api.get("/api/issues", IssueList).then((r) => setIssues(r.issues.filter((i) => i.examId === examId)), () => {});
  }, [examId]);
  React.useEffect(() => { load(); }, [load]);
  return (
    <div className="rounded-lg border bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Flag className="size-4 text-subtle-foreground" aria-hidden />Report an issue</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">A wrong key, a candidate problem or something broken. Admins see every report.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}><Flag /> Report an issue</Button>
      {issues.length > 0 && (
        <ul className="mt-4 divide-y border-t text-sm">
          {issues.slice(0, 3).map((i) => (
            <li key={i.id} className="py-2"><span className="font-medium">{ISSUE_LABEL[i.category as keyof typeof ISSUE_LABEL] ?? i.category}</span> · <span className="num text-muted-foreground">{fmtTime(i.at, false)}</span><p className="line-clamp-2 text-muted-foreground">{i.body}</p></li>
          ))}
        </ul>
      )}
      <ReportIssueDialog examId={examId} open={open} onOpenChange={setOpen} onSent={load} />
    </div>
  );
}

export function ReportIssueDialog({ examId, open, onOpenChange, onSent }: { examId?: string; open: boolean; onOpenChange: (o: boolean) => void; onSent?: () => void }) {
  const [category, setCategory] = React.useState<keyof typeof ISSUE_LABEL>("content");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = IssueCreate.safeParse({ category, body, examId });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      await api.post("/api/issues", parsed.data);
      toast.success("Issue reported", { description: "It's recorded with your name and time." });
      setBody(""); setError(null); onOpenChange(false); onSent?.();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Couldn't send the report."); } finally { setPending(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>Say what happened and where. Don&apos;t include passwords or answer keys.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="iss-cat">About</Label>
            <select id="iss-cat" value={category} onChange={(e) => setCategory(e.target.value as keyof typeof ISSUE_LABEL)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus-visible:border-primary">
              {IssueCategory.options.map((c) => <option key={c} value={c}>{ISSUE_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="iss-body">What happened</Label>
            <Textarea id="iss-body" rows={4} maxLength={1000} value={body} onChange={(e) => { setBody(e.target.value); setError(null); }} className="mt-1.5"
              placeholder="e.g. Question 6's key looks wrong: option C is the correct median." aria-invalid={!!error} aria-describedby="iss-err" />
            <p id="iss-err" className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-muted-foreground")} aria-live="polite">{error ?? `${body.length}/1000`}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Flag />} Send report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
