import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { attempts, exams, users } from "../../db/schema";
import { database } from "./database";
import { fail } from "./errors";
import { examPool, ownedExam, paperSections } from "./exams";
import { answered, groupPapers, mark, paperRows, type GradeRow } from "./grading";
import type { PaperQuestion } from "./paper";

const average = (values: number[]) => values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : null;
const round = (value: number | null) => value === null ? null : Math.round(value * 10_000) / 10_000;

function correlation(points: Array<[number, number]>) {
  if (points.length < 3) return null;
  const mx = average(points.map(([x]) => x))!;
  const my = average(points.map(([, y]) => y))!;
  let xy = 0, xx = 0, yy = 0;
  for (const [x, y] of points) {
    xy += (x - mx) * (y - my);
    xx += (x - mx) ** 2;
    yy += (y - my) ** 2;
  }
  return xx && yy ? xy / Math.sqrt(xx * yy) : null;
}

function distribution(values: number[]) {
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: (i + 1) * 10, count: 0 }));
  for (const value of values) bins[Math.min(9, Math.max(0, Math.floor(value * 10)))].count++;
  return bins;
}

export async function analyticalData(examinerId: string, examId: string) {
  const db = database();
  const [exam] = await db.select().from(exams).where(and(eq(exams.id, examId), eq(exams.examinerId, examinerId)));
  if (!exam) fail(403, "FORBIDDEN", "This exam is unavailable.");
  const rows = await db.select({
    id: attempts.id, candidateId: users.id, name: users.name, email: users.email,
    score: attempts.scoreCents, settings: attempts.settings, at: attempts.submittedAt,
  }).from(attempts).innerJoin(users, eq(users.id, attempts.candidateId))
    .where(and(eq(attempts.examId, examId), eq(attempts.status, "graded"), eq(attempts.isSandbox, false)));
  const papers = groupPapers(await paperRows(db, rows.map(({ id }) => id)));
  return { exam, rows, papers };
}

type Dataset = Awaited<ReturnType<typeof analyticalData>>;
export async function examSummary(owner: string, examId: string) {
  const { exam, rows } = await analyticalData(owner, examId);
  const sorted = rows.map(({ score }) => (score ?? 0) / 100).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    title: exam.title, published: exam.resultsPublished, totalMarks: exam.totalMarks, count: sorted.length,
    mean: round(average(sorted)), median: sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null,
    min: sorted[0] ?? null, max: sorted.at(-1) ?? null, passMark: exam.totalMarks * 0.5,
    passRate: round(average(sorted.map((score) => Number(score >= exam.totalMarks * 0.5)))),
    distribution: distribution(sorted.map((score) => score / exam.totalMarks)),
  };
}

function items({ rows, papers }: Dataset) {
  type Point = { row: GradeRow; fraction: number; rest: number };
  const grouped = new Map<string, Point[]>();
  for (const attempt of rows) {
    for (const row of papers.get(attempt.id) ?? []) {
      const cents = mark(row, attempt.settings.multiSelectRule) ?? 0;
      const group = grouped.get(row.qid) ?? [];
      group.push({ row, fraction: cents / (row.marks * 100), rest: ((attempt.score ?? 0) - cents) / 100 });
      grouped.set(row.qid, group);
    }
  }
  return [...grouped].map(([qid, points]) => {
    const first = points[0].row;
    const facility = average(points.map(({ fraction }) => fraction))!;
    const discrimination = correlation(points.map(({ fraction, rest }) => [fraction, rest]));
    const wrong = new Map<string, number>();
    for (const { row } of points) {
      if (row.type === "written") continue;
      const selected = Array.isArray(row.response) ? row.response : row.response ? [row.response] : [];
      for (const choice of selected) if (!row.key.includes(choice)) wrong.set(choice, (wrong.get(choice) ?? 0) + 1);
    }
    const wrongId = [...wrong].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { qid, text: first.text, observations: points.length, facility: round(facility), discrimination: round(discrimination),
      skipped: round(average(points.map(({ row }) => Number(!answered(row.response))))),
      mostChosenWrong: first.options.find(({ id }) => id === wrongId)?.text ?? null,
      flags: [
        discrimination !== null && discrimination < 0 ? "Check answer key" : discrimination !== null && discrimination < 0.15 ? "Low discrimination" : null,
        facility < 0.2 ? "Very hard" : facility > 0.92 ? "Too easy" : null,
      ].filter(Boolean),
    };
  });
}

export async function itemStats(owner: string, examId: string) {
  return items(await analyticalData(owner, examId));
}

function sample<T>(source: T[], count: number) {
  const array = source.slice();
  for (let i = 0; i < Math.min(count, array.length); i++) {
    const j = i + Math.floor(Math.random() * (array.length - i));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.slice(0, count);
}

export async function fairness(owner: string, examId: string) {
  const data = await analyticalData(owner, examId);
  const { pool, sections } = await database().transaction(async (tx) => {
    const exam = await ownedExam(tx, owner, examId);
    return { pool: await examPool(tx, exam), sections: await paperSections(tx, exam) };
  });
  const measured = new Map(items(data).map(({ qid, facility }) => [qid, facility]));
  // One sampling group per blueprint cell inside each section; a section without cells always contributes all its questions.
  const groups = sections.flatMap((section) => {
    const members = section.id === null ? pool : pool.filter((q) => q.sectionId === section.id);
    if (!section.blueprint) return [{ items: members, count: members.length }];
    const partition = new Map<string, PaperQuestion[]>();
    for (const q of members) {
      const key = JSON.stringify([q.topic, q.difficulty]);
      partition.set(key, [...(partition.get(key) ?? []), q]);
    }
    return section.blueprint.map((cell) => ({ items: partition.get(JSON.stringify([cell.topic, cell.difficulty])) ?? [], count: cell.count }));
  });
  const count = groups.reduce((sum, group) => sum + group.count, 0);
  const ease = (paper: PaperQuestion[]) => average(paper.map((q) => measured.get(q.id) ?? (1 - q.difficulty / 4))) ?? 0;
  if (!count || groups.some((group) => group.items.length < group.count)) return { simulations: 0, blueprint: [], naive: [] };
  const naive = [], blueprint = [];
  for (let i = 0; i < 500; i++) {
    naive.push(ease(sample(pool, count)));
    blueprint.push(ease(groups.flatMap((group) => sample(group.items, group.count))));
  }
  const summary = (values: number[]) => ({
    mean: round(average(values)), min: round(Math.min(...values)), max: round(Math.max(...values)), distribution: distribution(values),
  });
  return { simulations: 500, blueprint: summary(blueprint), naive: summary(naive),
    basis: measured.size ? "Observed facility where available; authored difficulty for the rest" : "Authored difficulty" };
}

export async function collusion(owner: string, examId: string) {
  const { rows, papers } = await analyticalData(owner, examId);
  const bank = new Map<string, Array<{ candidate: string; signature: string | null }>>();
  for (const row of rows) {
    for (const q of papers.get(row.id) ?? []) {
      if (q.type === "written") continue;
      const responses = bank.get(q.qid) ?? [];
      const chosen = Array.isArray(q.response) ? q.response : q.response ? [q.response] : [];
      const signature = chosen.some((value) => !q.key.includes(value)) ? JSON.stringify([...chosen].sort()) : null;
      responses.push({ candidate: row.candidateId, signature });
      bank.set(q.qid, responses);
    }
  }
  const pairs = new Map<string, { left: string; right: string; observed: number; expected: number; shared: number }>();
  for (const entries of bank.values()) {
    if (entries.length < 5 || entries.length > 1_000) continue;
    const frequencies = new Map<string, number>();
    for (const { signature } of entries) if (signature) frequencies.set(signature, (frequencies.get(signature) ?? 0) + 1);
    const p = [...frequencies.values()].reduce((sum, n) => sum + n * (n - 1), 0) / (entries.length * (entries.length - 1));
    for (const [i, left] of entries.entries()) for (let j = i + 1; j < entries.length; j++) {
      const right = entries[j];
      const ids = [left.candidate, right.candidate].sort();
      const key = ids.join("/");
      const pair = pairs.get(key) ?? { left: ids[0], right: ids[1], observed: 0, expected: 0, shared: 0 };
      pair.shared++;
      pair.expected += p;
      if (left.signature && left.signature === right.signature) pair.observed++;
      pairs.set(key, pair);
    }
  }
  const names = new Map(rows.map(({ candidateId, name }) => [candidateId, name]));
  return [...pairs.values()].filter((pair) => pair.observed >= 3 && pair.observed - pair.expected >= Math.max(2, 3 * Math.sqrt(pair.expected)))
    .sort((a, b) => b.observed - a.observed).slice(0, 100).map((pair) => ({
      candidates: [names.get(pair.left), names.get(pair.right)], matchingWrongAnswers: pair.observed,
      questionsCompared: pair.shared, label: "Possible answer sharing — review",
    }));
}

export async function moodleGrades(owner: string, examId: string) {
  const { exam, rows } = await analyticalData(owner, examId);
  if (!exam.resultsPublished) fail(409, "RESULTS_UNPUBLISHED", "Publish results before exporting grades.");
  return Papa.unparse(rows.map(({ email, name, score }) => ({ Email: email, "Full name": name, Grade: (score ?? 0) / 100 })),
    { columns: ["Email", "Full name", "Grade"], escapeFormulae: true });
}
