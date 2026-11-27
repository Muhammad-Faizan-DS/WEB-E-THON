"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleDot, ListChecks, PenLine, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client/api";
import { CandidateList, CreatedExam, ExamDraft, publishProblems, type QuestionDraft } from "@/lib/client/authoring";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Candidate = { id: string; name: string; email: string; studentId: string | null };
const TYPE_LABEL = { single: "Single choice", multi: "Multiple select", written: "Written answer" } as const;
const OPENS = [{ v: 0, l: "Now" }, { v: 15, l: "In 15 minutes" }, { v: 60, l: "In 1 hour" }, { v: 1440, l: "Tomorrow, same time" }];
const WINDOW = [{ v: 60, l: "1 hour" }, { v: 180, l: "3 hours" }, { v: 720, l: "12 hours" }, { v: 1440, l: "24 hours" }, { v: 4320, l: "3 days" }];

const blank = (type: QuestionDraft["type"]): QuestionDraft => ({
  type, topic: "", prompt: "", marks: type === "written" ? 5 : 1,
  options: type === "written" ? [] : ["", "", ""], correct: [], multiRule: "exact",
});

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [code, setCode] = React.useState("");
  const [durationMin, setDuration] = React.useState(20);
  const [opensInMin, setOpensIn] = React.useState(0);
  const [openForMin, setOpenFor] = React.useState(1440);
  const [instructions, setInstructions] = React.useState("");
  const [pastePolicy, setPaste] = React.useState<"block" | "log" | "allow">("block");
  const [fullscreenRequired, setFullscreen] = React.useState(false);
  const [questions, setQuestions] = React.useState<QuestionDraft[]>([blank("single")]);
  const [candidates, setCandidates] = React.useState<Candidate[] | null>(null);
  const [enrolled, setEnrolled] = React.useState<Set<string>>(new Set());
  const [problems, setProblems] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<"draft" | "publish" | null>(null);
  const summaryRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    api.get("/api/candidates", CandidateList).then((d) => setCandidates(d.candidates), () => setCandidates([]));
  }, []);

  const setQ = (i: number, p: Partial<QuestionDraft>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  async function save(publish: boolean) {
    const draft = { title, code, durationMin, opensInMin, openForMin, instructions, pastePolicy, fullscreenRequired, questions, enrolled: [...enrolled] };
    const parsed = ExamDraft.safeParse(draft);
    const list = parsed.success ? [] : parsed.error.issues.map((iss) => {
      if (iss.path[0] === "questions" && typeof iss.path[1] === "number") return `Question ${iss.path[1] + 1}: ${iss.message}`;
      return iss.message;
    });
    if (parsed.success && publish) list.push(...publishProblems(parsed.data));
    if (list.length) {
      setProblems([...new Set(list)]);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setProblems([]);
    setBusy(publish ? "publish" : "draft");
    try {
      const res = await api.post("/api/exams", { ...parsed.data!, publish }, CreatedExam);
      toast.success(publish ? "Exam published" : "Draft saved", { description: publish ? `${enrolled.size} candidate${enrolled.size === 1 ? "" : "s"} can see it on their exams page.` : "You can find it on your dashboard." });
      router.push(`/examiner/exams/${res.examId}`);
    } catch (e) {
      setProblems([(e as ApiError).message]);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-28">
      <Link href="/examiner" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Dashboard</Link>
      <h1 className="text-[26px] font-semibold tracking-[-0.01em]">New exam</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Build the paper, set the window and rules, enrol candidates, then publish. Candidates see it on their exams page straight away.</p>

      {problems.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} className="mt-6 outline-none">
          <Alert tone="danger" title={`Fix ${problems.length === 1 ? "this" : `these ${problems.length} things`} first`} role="alert">
            <ul className="list-disc space-y-0.5 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </Alert>
        </div>
      )}

      {/* 1. basics */}
      <Section n={1} title="Basics">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field id="title" label="Title"><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Statistics Quiz 2" /></Field>
          <Field id="code" label="Code"><Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="STAT-201" className="font-mono" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="dur" label="Time allowed (minutes)"><Input id="dur" type="number" inputMode="numeric" min={1} max={300} value={durationMin} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
          <Field id="opens" label="Opens">
            <select id="opens" value={opensInMin} onChange={(e) => setOpensIn(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm">
              {OPENS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
          <Field id="window" label="Stays open for">
            <select id="window" value={openForMin} onChange={(e) => setOpenFor(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm">
              {WINDOW.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-[13px] text-muted-foreground">Each candidate gets {durationMin || 0} minutes from when they start, but never past the moment the window closes. All times are Pakistan time (PKT).</p>
        <Field id="ins" label="Instructions for candidates (optional)"><Textarea id="ins" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Calculators allowed. Show your working in written answers." /></Field>
      </Section>

      {/* 2. questions */}
      <Section n={2} title="Questions" aside={<span className="num text-[13px] text-muted-foreground">{questions.length} question{questions.length === 1 ? "" : "s"} · {totalMarks} marks</span>}>
        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li key={i} className="rounded-lg border bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">Question {i + 1} <span className="font-normal text-muted-foreground">· {TYPE_LABEL[q.type]}</span></p>
                <Button variant="ghost" size="sm" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}><Trash2 /> <span className="hidden sm:inline">Remove</span></Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
                <Field id={`t${i}`} label="Topic"><Input id={`t${i}`} value={q.topic} onChange={(e) => setQ(i, { topic: e.target.value })} placeholder="Probability" /></Field>
                <Field id={`m${i}`} label="Marks"><Input id={`m${i}`} type="number" inputMode="numeric" min={1} max={100} value={q.marks} onChange={(e) => setQ(i, { marks: Number(e.target.value) })} /></Field>
              </div>
              <div className="mt-3"><Field id={`p${i}`} label="Question"><Textarea id={`p${i}`} rows={2} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} className="q-text" /></Field></div>
              {q.type !== "written" && (
                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-medium">Options <span className="font-normal text-muted-foreground">· {q.type === "single" ? "select the correct one" : "tick every correct one"}</span></legend>
                  <ul className="space-y-2">
                    {q.options.map((opt, k) => (
                      <li key={k} className="flex items-center gap-2.5">
                        <input
                          type={q.type === "single" ? "radio" : "checkbox"} name={`c${i}`} checked={q.correct.includes(k)}
                          aria-label={`Option ${String.fromCharCode(65 + k)} is correct`}
                          onChange={(e) => setQ(i, { correct: q.type === "single" ? [k] : e.target.checked ? [...q.correct, k] : q.correct.filter((x) => x !== k) })}
                          className="size-4 shrink-0"
                        />
                        <span className="w-4 text-[13px] font-medium text-muted-foreground" aria-hidden>{String.fromCharCode(65 + k)}</span>
                        <Input aria-label={`Option ${String.fromCharCode(65 + k)}`} value={opt} onChange={(e) => setQ(i, { options: q.options.map((o, j) => (j === k ? e.target.value : o)) })} />
                        <Button variant="ghost" size="icon-sm" disabled={q.options.length <= 2} aria-label={`Remove option ${String.fromCharCode(65 + k)}`}
                          onClick={() => setQ(i, { options: q.options.filter((_, j) => j !== k), correct: q.correct.filter((x) => x !== k).map((x) => (x > k ? x - 1 : x)) })}><X /></Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    {q.options.length < 6 && <Button variant="ghost" size="sm" onClick={() => setQ(i, { options: [...q.options, ""] })}><Plus /> Add option</Button>}
                    {q.type === "multi" && (
                      <label className="flex items-center gap-2 text-[13px]">
                        Marking
                        <select value={q.multiRule} onChange={(e) => setQ(i, { multiRule: e.target.value as "exact" | "partial" })} className="h-8 rounded-md border border-input bg-surface px-2 text-[13px]">
                          <option value="exact">Exact match only</option>
                          <option value="partial">Partial credit</option>
                        </select>
                      </label>
                    )}
                  </div>
                </fieldset>
              )}
              {q.type === "written" && <p className="mt-3 text-[13px] text-muted-foreground">Written answers are marked by you in the grading queue after the exam.</p>}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, blank("single")])}><CircleDot /> Add single choice</Button>
          <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, blank("multi")])}><ListChecks /> Add multiple select</Button>
          <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, blank("written")])}><PenLine /> Add written answer</Button>
        </div>
      </Section>

      {/* 3. rules */}
      <Section n={3} title="Rules">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Pasting into answers</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {([["block", "Blocked (attempts noted by length)"], ["log", "Allowed, noted by length"], ["allow", "Allowed, not noted"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2"><input type="radio" name="paste" checked={pastePolicy === v} onChange={() => setPaste(v)} className="size-4" />{l}</label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fullscreenRequired} onChange={(e) => setFullscreen(e.target.checked)} className="size-4" />Require fullscreen (questions hide while outside it; the timer keeps running)</label>
        <p className="text-[13px] text-muted-foreground">Integrity observations are hints for you to review. They never change marks or time on their own.</p>
      </Section>

      {/* 4. enrolment */}
      <Section n={4} title="Candidates" aside={<span className="num text-[13px] text-muted-foreground">{enrolled.size} enrolled</span>}>
        {!candidates ? <p className="text-sm text-muted-foreground">Loading candidates…</p> : (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4" checked={candidates.length > 0 && enrolled.size === candidates.length}
                onChange={(e) => setEnrolled(e.target.checked ? new Set(candidates.map((c) => c.id)) : new Set())} />
              Select all {candidates.length}
            </label>
            <ul className="grid max-h-72 gap-x-6 overflow-y-auto rounded-lg border bg-surface p-3 sm:grid-cols-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-10 items-center gap-2.5 text-sm">
                    <input type="checkbox" className="size-4 shrink-0" checked={enrolled.has(c.id)}
                      onChange={(e) => setEnrolled((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
                    <span className="min-w-0 truncate">{c.name} <span className="font-mono text-[12px] text-muted-foreground">{c.studentId ?? c.email}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="num text-[13px] text-muted-foreground">{questions.length} question{questions.length === 1 ? "" : "s"} · {totalMarks} marks · {enrolled.size} enrolled</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={!!busy}>{busy === "draft" ? "Saving…" : "Save draft"}</Button>
            <Button onClick={() => save(true)} disabled={!!busy}><Send /> {busy === "publish" ? "Publishing…" : "Publish"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`} className="mt-10 border-t pt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`s${n}`} className="text-base font-semibold"><span className="mr-2 font-mono text-[12px] text-muted-foreground">0{n}</span>{title}</h2>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className={cn("space-y-1.5")}><Label htmlFor={id}>{label}</Label>{children}</div>;
}
