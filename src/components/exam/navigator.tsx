"use client";
import { Check, CloudUpload, Flag } from "lucide-react";
import type { CandidateQuestion } from "@/contracts";
import { isAnswered, type LocalAnswer } from "@/lib/client/exam-engine";
import { cn } from "@/lib/utils";

export type QState = "current" | "answered" | "visited" | "unvisited";

export function questionState(a: LocalAnswer | undefined, visited: boolean): Exclude<QState, "current"> {
  if (a && isAnswered(a.value)) return "answered";
  return visited ? "visited" : "unvisited";
}

export function describe(q: CandidateQuestion, a: LocalAnswer | undefined, visited: boolean) {
  const st = questionState(a, visited);
  const parts = [`Question ${q.position}`, st === "answered" ? "answered" : st === "visited" ? "not answered" : "not visited"];
  if (a?.flagged) parts.push("marked for review");
  if (a && (a.sync === "pending" || a.sync === "saving")) parts.push("not yet saved to server");
  if (a?.sync === "rejected") parts.push("change not accepted");
  return parts.join(", ");
}

export function Navigator({
  questions, answers, visited, current, onJump,
}: { questions: CandidateQuestion[]; answers: Record<string, LocalAnswer>; visited: Set<string>; current: number; onJump: (i: number) => void }) {
  const counts = { answered: 0, visited: 0, unvisited: 0, flagged: 0 };
  questions.forEach((q) => {
    const a = answers[q.aqId];
    counts[questionState(a, visited.has(q.aqId))]++;
    if (a?.flagged) counts.flagged++;
  });

  return (
    <nav aria-label="Question navigator" className="flex flex-col gap-4">
      <ol className="grid grid-cols-5 gap-2">
        {questions.map((q, i) => {
          const a = answers[q.aqId];
          const st = questionState(a, visited.has(q.aqId));
          const unsynced = a && (a.sync === "pending" || a.sync === "saving" || a.sync === "rejected");
          return (
            <li key={q.aqId}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={i === current ? "step" : undefined}
                aria-label={describe(q, a, visited.has(q.aqId))}
                className={cn(
                  "relative grid aspect-square w-full place-items-center rounded-md border text-sm font-semibold tabular-nums transition-colors",
                  st === "answered" && "border-success bg-success text-white dark:text-background",
                  st === "visited" && "border-danger/60 bg-danger-soft text-danger",
                  st === "unvisited" && "border-border bg-surface text-muted-foreground hover:bg-surface-2",
                  a?.flagged && "ring-2 ring-flag ring-offset-1 ring-offset-background",
                  i === current && "outline-2 outline-offset-2 outline-foreground",
                )}
              >
                {q.position}
                {a?.flagged && <Flag className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-flag p-0.5 text-white" aria-hidden />}
                {unsynced && <CloudUpload className={cn("absolute -bottom-1.5 -right-1.5 size-4 rounded-full p-0.5 text-white", a?.sync === "rejected" ? "bg-danger" : "bg-warning")} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs" aria-label="Legend">
        <Legend swatch="border-success bg-success" icon={<Check className="size-3 text-white" />} label="Answered" n={counts.answered} />
        <Legend swatch="border-danger/60 bg-danger-soft" label="Not answered" n={counts.visited} />
        <Legend swatch="border-border bg-surface" label="Not visited" n={counts.unvisited} />
        <Legend swatch="border-flag bg-flag" icon={<Flag className="size-3 text-white" />} label="For review" n={counts.flagged} />
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="size-4 rounded-full bg-warning p-0.5 text-white" aria-hidden /> Waiting to reach the server
      </p>
    </nav>
  );
}

function Legend({ swatch, icon, label, n }: { swatch: string; icon?: React.ReactNode; label: string; n: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("grid size-5 shrink-0 place-items-center rounded border", swatch)} aria-hidden>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="font-semibold tabular-nums">{n}</span>
    </li>
  );
}
