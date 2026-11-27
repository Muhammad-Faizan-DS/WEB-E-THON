import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { type BlueprintCell, type ExamSettings, type QuestionInput } from "@/lib/contracts/core";

export type PaperQuestion = QuestionInput & { id: string; sectionId?: string | null; position?: number };
/**
 * A section as the paper engine sees it (PRD §24.3). `blueprint: null` means "use every question in the section".
 * `id: null` matches the whole pool (legacy single-section call sites such as the seed).
 */
export type PaperSection = { id: string | null; title: string; blueprint: BlueprintCell[] | null; shuffle: boolean; marksPerQuestion: number | null };

export function wholePoolSection(settings: ExamSettings): PaperSection {
  return { id: null, title: "", blueprint: settings.blueprint.length ? settings.blueprint : null, shuffle: true, marksPerQuestion: null };
}

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

const members = (pool: PaperQuestion[], section: PaperSection) =>
  section.id === null ? pool : pool.filter((question) => question.sectionId === section.id);

/** Publish checklist for the paper: every section has questions, every cell is satisfiable, every draw totals the exam marks. */
export function checkPaper(pool: PaperQuestion[], sections: PaperSection[], totalMarks: number) {
  const issues: string[] = [];
  if (pool.length === 0) issues.push("Select at least one question.");
  if (sections.length === 0) issues.push("Add at least one section.");
  const label = (section: PaperSection) => sections.length > 1 ? `${section.title}: ` : "";
  let min = 0;
  let max = 0;
  for (const section of sections) {
    const items = members(pool, section);
    const marksOf = (question: PaperQuestion) => section.marksPerQuestion ?? question.marks;
    if (pool.length > 0 && items.length === 0) {
      issues.push(`${section.title || "This section"} has no questions.`);
      continue;
    }
    if (!section.blueprint) {
      const total = items.reduce((sum, question) => sum + marksOf(question), 0);
      min += total;
      max += total;
      continue;
    }
    const cells = group(items);
    for (const cell of section.blueprint) {
      const available = cells.get(cellKey(cell.topic, cell.difficulty)) ?? [];
      if (available.length < cell.count) {
        issues.push(`${label(section)}${cell.topic} (difficulty ${cell.difficulty}) needs ${cell.count}; ${available.length} available.`);
        continue;
      }
      const values = available.map(marksOf).sort((a, b) => a - b);
      min += values.slice(0, cell.count).reduce((sum, value) => sum + value, 0);
      max += values.slice(-cell.count).reduce((sum, value) => sum + value, 0);
    }
  }
  if (issues.length === 0 && (min !== totalMarks || max !== totalMarks)) {
    issues.push(sections.length > 1
      ? `Section marks must add up to ${totalMarks} on every paper. The current range is ${min}–${max}.`
      : `Every possible paper must total ${totalMarks} marks. The current range is ${min}–${max}.`);
  }
  return issues;
}

export function reattemptIssues(pool: PaperQuestion[], sections: PaperSection[]) {
  let size = 0;
  let replacements = 0;
  for (const section of sections) {
    const items = members(pool, section);
    if (!section.blueprint) { size += items.length; continue; }
    const cells = group(items);
    for (const cell of section.blueprint) {
      size += cell.count;
      const available = cells.get(cellKey(cell.topic, cell.difficulty))?.length ?? 0;
      replacements += Math.max(0, Math.min(cell.count, available - cell.count));
    }
  }
  return replacements < Math.ceil(size / 2) ? ["Add enough alternatives in the same blueprint cells to replace half of a re-attempt paper."] : [];
}

/**
 * Draws one candidate paper: sections in order, blueprint cells drawn within each section,
 * questions shuffled within a section when it allows shuffling. A re-attempt keeps about half of the prior questions (BR-11).
 */
export function drawPaper(pool: PaperQuestion[], settings: ExamSettings,
  options: { sections?: PaperSection[]; previous?: Set<string>; seed?: Buffer } = {}) {
  const { previous } = options;
  const sections = options.sections ?? [wholePoolSection(settings)];
  // A candidate's activation key seeds the draw (see paperSeed), so the key alone reproduces that candidate's paper.
  const seed = options.seed ?? randomBytes(32);
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
  const picks = sections.flatMap((section, index) => {
    const items = members(pool, section);
    const groups = section.blueprint
      ? section.blueprint.map((cell) => ({ count: cell.count, items: group(items).get(cellKey(cell.topic, cell.difficulty)) ?? [] }))
      : [{ count: items.length, items }];
    return groups.map(({ count, items: cell }) => {
      const shuffled = shuffle(cell);
      return { index, count, fresh: shuffled.filter((q) => !previous?.has(q.id)), prior: shuffled.filter((q) => previous?.has(q.id)) };
    });
  });
  let extraRetained = Math.floor(picks.reduce((sum, p) => sum + p.count, 0) / 2) -
    picks.reduce((sum, p) => sum + Math.max(0, p.count - p.fresh.length), 0);
  const drawn = shuffle(picks).flatMap(({ index, count, fresh, prior }) => {
    if (!previous) return fresh.slice(0, count).map((question) => ({ index, question }));
    const required = Math.max(0, count - fresh.length);
    const additional = Math.min(Math.max(0, extraRetained), Math.max(0, Math.min(count, prior.length) - required));
    extraRetained -= additional;
    const retained = required + additional;
    return [...prior.slice(0, retained), ...fresh.slice(0, count - retained)].map((question) => ({ index, question }));
  });
  const ordered = sections.flatMap((section, index) => {
    const chosen = drawn.filter((item) => item.index === index).map(({ question }) => question);
    const placed = section.shuffle ? shuffle(chosen) : chosen.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
    return placed.map((question) => ({ question, section }));
  });
  return ordered.map(({ question, section }, index) => ({
    questionId: question.id,
    sectionId: section.id,
    position: index + 1,
    type: question.type,
    text: question.text,
    marks: section.marksPerQuestion ?? question.marks,
    options: (settings.shuffleOptions ? shuffle(question.options) : question.options).map(({ id, text }) => ({ id, text })),
    answerKey: question.options.filter(({ isCorrect }) => isCorrect).map(({ id }) => id),
  }));
}

export function newSessionId() {
  return randomUUID();
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required.");
  return value;
}

/** Ignores case, spaces and dashes so "ab12-cd34" and "AB12CD34" are the same key. */
export function normalizeKey(key: string) {
  return key.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function newActivationKey() {
  return randomBytes(8).toString("hex").toUpperCase();
}

/**
 * The activation key for one key row: 16 random-looking hex characters derived from the row id and AUTH_SECRET.
 * Only its hash is stored, yet the owning examiner can display or print it again; a database copy alone cannot.
 */
export function activationKeyFor(keyId: string) {
  return createHmac("sha256", secret()).update("secureexam:issued-key:").update(keyId).digest("hex").slice(0, 16).toUpperCase();
}

/** Formats a key for people: ABCD-EF12-3456-7890. Entry accepts it with or without dashes. */
export function displayKey(key: string) {
  return normalizeKey(key).match(/.{1,4}/g)?.join("-") ?? key;
}

export function hashKey(key: string) {
  return createHmac("sha256", secret()).update("secureexam:activation-key:").update(normalizeKey(key)).digest("hex");
}

/** The paper seed for a candidate: their activation key decides question selection, question order and option order. */
export function paperSeed(key: string) {
  return createHmac("sha256", secret()).update("secureexam:paper:").update(normalizeKey(key)).digest();
}

export function keyMatches(candidateKey: string, expectedHash: string) {
  return timingSafeEqual(Buffer.from(hashKey(candidateKey), "hex"), Buffer.from(expectedHash, "hex"));
}
