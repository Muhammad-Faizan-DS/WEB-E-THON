"use client";
import { ArrowLeft, CheckCircle2, CircleDashed, CloudUpload, Flag, Send, XCircle } from "lucide-react";
import type { CandidateQuestion } from "@/contracts";
import { isAnswered, type LocalAnswer } from "@/lib/client/exam-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ReviewPanel({
  questions, answers, onJump, onBack, onSubmit,
}: { questions: CandidateQuestion[]; answers: Record<string, LocalAnswer>; onJump: (i: number) => void; onBack: () => void; onSubmit: () => void }) {
  const answered = questions.filter((q) => isAnswered(answers[q.aqId]?.value));
  const flagged = questions.filter((q) => answers[q.aqId]?.flagged);
  const unsynced = questions.filter((q) => ["pending", "saving"].includes(answers[q.aqId]?.sync ?? ""));
  const rejected = questions.filter((q) => answers[q.aqId]?.sync === "rejected");
  const blank = questions.length - answered.length;

  return (
    <section aria-labelledby="review-title" className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 id="review-title" className="text-2xl font-semibold tracking-tight">Review before you submit</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select any question to go back to it. You can&apos;t change answers after submitting.</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={CheckCircle2} tone="text-success" label="Answered" n={answered.length} of={questions.length} />
        <Stat icon={CircleDashed} tone="text-danger" label="Not answered" n={blank} />
        <Stat icon={Flag} tone="text-flag" label="For review" n={flagged.length} />
        <Stat icon={CloudUpload} tone="text-warning" label="Not yet saved" n={unsynced.length + rejected.length} />
      </dl>
      <ol className="divide-y rounded-lg border bg-surface">
        {questions.map((q, i) => {
          const a = answers[q.aqId];
          const done = isAnswered(a?.value);
          return (
            <li key={q.aqId}>
              <button type="button" onClick={() => onJump(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <span className="w-8 shrink-0 font-mono text-sm text-muted-foreground">Q{q.position}</span>
                <span className="line-clamp-1 flex-1 text-sm">{q.prompt}</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {a?.flagged && <Badge tone="flag"><Flag aria-hidden />Review</Badge>}
                  {a?.sync === "rejected" ? <Badge tone="danger"><XCircle aria-hidden />Not accepted</Badge>
                    : a && a.sync !== "synced" ? <Badge tone="warning"><CloudUpload aria-hidden />Not saved yet</Badge> : null}
                  <Badge tone={done ? "success" : "danger"}>{done ? <CheckCircle2 aria-hidden /> : <CircleDashed aria-hidden />}{done ? "Answered" : "Blank"}</Badge>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft /> Back to questions</Button>
        <Button size="lg" onClick={onSubmit}><Send /> Submit exam</Button>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, tone, label, n, of }: { icon: typeof Flag; tone: string; label: string; n: number; of?: number }) {
  return (
    <div className="rounded-lg border bg-surface p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className={cn("size-4", tone)} aria-hidden />{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{n}{of !== undefined && <span className="text-base font-normal text-muted-foreground">/{of}</span>}</dd>
    </div>
  );
}
