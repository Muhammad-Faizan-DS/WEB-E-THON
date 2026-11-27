"use client";
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

const FLAG_CORNER = "pointer-events-none absolute right-0 top-0 size-3.5 rounded-tr-[5px] bg-flag [clip-path:polygon(0_0,100%_0,100%_100%)]";

/** Answer-sheet grid. Shape and fill carry state; colour is never the only signal (legend + aria-label). */
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
    <nav aria-label="Question navigator" className="flex flex-col gap-5">
      <ol className="grid grid-cols-5 gap-1.5">
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
                  "num relative grid aspect-square w-full cursor-pointer place-items-center rounded-[5px] border text-[13px] font-semibold transition-colors",
                  st === "answered" && "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
                  st === "visited" && "border-border-strong bg-surface text-foreground hover:bg-surface-2",
                  st === "unvisited" && "border-border bg-transparent text-subtle-foreground hover:bg-surface",
                  i === current && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
              >
                {q.position}
                {st === "visited" && <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-danger" aria-hidden />}
                {a?.flagged && <span className={FLAG_CORNER} aria-hidden />}
                {unsynced && <span className={cn("absolute -bottom-1 -right-1 size-2.5 rounded-full ring-2 ring-background", a?.sync === "rejected" ? "bg-danger" : "bg-warning-dot")} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="space-y-2 text-[12px]" aria-label="Legend">
        <Legend swatch={<span className="block size-4 rounded-[4px] bg-primary" />} label="Answered" n={counts.answered} />
        <Legend swatch={<span className="relative block size-4 rounded-[4px] border border-border-strong bg-surface"><span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-danger" /></span>} label="Seen, not answered" n={counts.visited} />
        <Legend swatch={<span className="block size-4 rounded-[4px] border border-border" />} label="Not seen yet" n={counts.unvisited} />
        <Legend swatch={<span className="relative block size-4 rounded-[4px] border border-border-strong bg-surface"><span className="absolute right-0 top-0 size-2.5 rounded-tr-[3px] bg-flag [clip-path:polygon(0_0,100%_0,100%_100%)]" /></span>} label="Marked for review" n={counts.flagged} />
        <Legend swatch={<span className="grid size-4 place-items-center"><span className="size-2.5 rounded-full bg-warning-dot" /></span>} label="Waiting to reach the server" />
      </ul>
    </nav>
  );
}

function Legend({ swatch, label, n }: { swatch: React.ReactNode; label: string; n?: number }) {
  return (
    <li className="flex items-center gap-2.5">
      <span aria-hidden>{swatch}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      {n !== undefined && <span className="num font-semibold">{n}</span>}
    </li>
  );
}
