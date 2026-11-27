"use client";
import { ArrowLeft, CloudUpload, Flag, Send, XCircle } from "lucide-react";
import type { CandidateQuestion } from "@/contracts";
import { isAnswered, type LocalAnswer } from "@/lib/client/exam-engine";
import { Button } from "@/components/ui/button";
import { Badge, Status } from "@/components/ui/badge";
import { StatStrip } from "@/components/ui/card";

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
        <h2 id="review-title" className="text-[26px] font-semibold tracking-[-0.01em]">Review before you submit</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select any question to go back to it. You can&apos;t change answers after submitting.</p>
      </div>
      <StatStrip items={[
        { label: "Answered", value: <>{answered.length}<span className="text-base font-normal text-muted-foreground">/{questions.length}</span></> },
        { label: "Not answered", value: blank, tone: blank ? "text-danger" : undefined },
        { label: "Marked for review", value: flagged.length },
        { label: "Not yet saved", value: unsynced.length + rejected.length, tone: unsynced.length + rejected.length ? "text-warning" : undefined },
      ]} />
      <ol className="divide-y rounded-lg border bg-surface">
        {questions.map((q, i) => {
          const a = answers[q.aqId];
          const done = isAnswered(a?.value);
          return (
            <li key={q.aqId}>
              <button type="button" onClick={() => onJump(i)} className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2">
                <span className="num w-8 shrink-0 text-[13px] font-semibold text-muted-foreground">{q.position}</span>
                <span className="line-clamp-1 flex-1 font-serif text-[15px]">{q.prompt}</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {a?.flagged && <Badge tone="flag"><Flag aria-hidden />Review</Badge>}
                  {a?.sync === "rejected" ? <Badge tone="danger"><XCircle aria-hidden />Not accepted</Badge>
                    : a && a.sync !== "synced" ? <Badge tone="warning"><CloudUpload aria-hidden />Not saved yet</Badge> : null}
                  <Status tone={done ? "success" : "danger"}>{done ? "Answered" : "Blank"}</Status>
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
