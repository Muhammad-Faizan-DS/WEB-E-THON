import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { type ExamSettings, type QuestionInput } from "@/lib/contracts/core";

export type PaperQuestion = QuestionInput & { id: string };

function cellKey(topic: string, difficulty: number) {
  return JSON.stringify([topic, difficulty]);
}

function group(pool: PaperQuestion[]) {
  const cells = new Map<string, PaperQuestion[]>();
  for (const item of pool) {
    const key = cellKey(item.topic, item.difficulty);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(item);
  }
  return cells;
}

export function checkPaper(pool: PaperQuestion[], blueprint: ExamSettings["blueprint"], totalMarks: number) {
  const issues: string[] = [];
  if (pool.length === 0) issues.push("Select at least one question.");
  if (blueprint.length === 0) issues.push("Add at least one blueprint cell.");
  const cells = group(pool);
  let min = 0;
  let max = 0;
  for (const cell of blueprint) {
    const available = cells.get(cellKey(cell.topic, cell.difficulty)) ?? [];
    if (available.length < cell.count) {
      issues.push(`${cell.topic} (difficulty ${cell.difficulty}) needs ${cell.count}; ${available.length} available.`);
      continue;
    }
    const values = available.map(({ marks }) => marks).sort((a, b) => a - b);
    min += values.slice(0, cell.count).reduce((sum, value) => sum + value, 0);
    max += values.slice(-cell.count).reduce((sum, value) => sum + value, 0);
  }
  if (issues.length === 0 && (min !== totalMarks || max !== totalMarks)) {
    issues.push(`Every possible paper must total ${totalMarks} marks. The current range is ${min}–${max}.`);
  }
  return issues;
}

export function reattemptIssues(pool: PaperQuestion[], blueprint: ExamSettings["blueprint"]) {
  const cells = group(pool);
  const size = blueprint.reduce((sum, cell) => sum + cell.count, 0);
  const replacements = blueprint.reduce((sum, cell) => {
    const available = cells.get(cellKey(cell.topic, cell.difficulty))?.length ?? 0;
    return sum + Math.max(0, Math.min(cell.count, available - cell.count));
  }, 0);
  return replacements < Math.ceil(size / 2) ? ["Add enough alternatives in the same blueprint cells to replace half of a re-attempt paper."] : [];
}

export function drawPaper(pool: PaperQuestion[], settings: ExamSettings, previous?: Set<string>) {
  const seed = randomBytes(32);
  let counter = 0;
  function shuffle<T>(items: T[]) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const bound = i + 1;
      const limit = 2 ** 32 - (2 ** 32 % bound);
      let value: number;
      do {
        value = createHmac("sha256", seed).update(String(counter++)).digest().readUInt32BE();
      } while (value >= limit);
      const j = value % bound;
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  const cells = group(pool);
  const picks = settings.blueprint.map((cell) => {
    const members = shuffle(cells.get(cellKey(cell.topic, cell.difficulty)) ?? []);
    return { count: cell.count, fresh: members.filter((q) => !previous?.has(q.id)), prior: members.filter((q) => previous?.has(q.id)) };
  });
  let extraRetained = Math.floor(picks.reduce((sum, p) => sum + p.count, 0) / 2) -
    picks.reduce((sum, p) => sum + Math.max(0, p.count - p.fresh.length), 0);
  const drawn = shuffle(picks).flatMap(({ count, fresh, prior }) => {
    if (!previous) return fresh.slice(0, count);
    const required = Math.max(0, count - fresh.length);
    const additional = Math.min(Math.max(0, extraRetained), Math.max(0, Math.min(count, prior.length) - required));
    extraRetained -= additional;
    const retained = required + additional;
    return [...prior.slice(0, retained), ...fresh.slice(0, count - retained)];
  });
  return shuffle(drawn).map((question, index) => ({
    questionId: question.id,
    position: index + 1,
    type: question.type,
    text: question.text,
    marks: question.marks,
    options: (settings.shuffleOptions ? shuffle(question.options) : question.options).map(({ id, text }) => ({ id, text })),
    answerKey: question.options.filter(({ isCorrect }) => isCorrect).map(({ id }) => id),
  }));
}

export function newSessionId() {
  return randomUUID();
}

export function newActivationKey() {
  return randomBytes(8).toString("hex").toUpperCase();
}

export function hashKey(key: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required.");
  return createHmac("sha256", secret).update("secureexam:activation-key:").update(key.toUpperCase()).digest("hex");
}

export function keyMatches(candidateKey: string, expectedHash: string) {
  return timingSafeEqual(Buffer.from(hashKey(candidateKey), "hex"), Buffer.from(expectedHash, "hex"));
}
