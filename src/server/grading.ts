import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { answers, attempts, attemptQuestions, exams, gradeNotices, incidents, integrityEvents, reattemptRequests, users } from "../../db/schema";
import type { AnswerResponse, ExamSettings } from "@/lib/contracts/core";
import { audit } from "./admin";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { ownedExam } from "./exams";
import { expiredBy } from "./integrity";

export type Attempt = typeof attempts.$inferSelect;
type GradeDb = Tx | ReturnType<typeof database>;

export async function paperRows(db: GradeDb, ids: string[]) {
  return ids.length ? db.select({
    attemptId: attemptQuestions.attemptId, qid: attemptQuestions.questionId, position: attemptQuestions.position,
    text: attemptQuestions.text, type: attemptQuestions.type, marks: attemptQuestions.marks, options: attemptQuestions.options,
    key: attemptQuestions.answerKey, response: answers.response, awardedCents: answers.awardedCents, zeroed: answers.zeroed,
    feedback: answers.feedback, editTimeline: answers.editTimeline,
  }).from(attemptQuestions).leftJoin(answers, and(eq(attemptQuestions.attemptId, answers.attemptId),
    eq(attemptQuestions.questionId, answers.questionId))).where(inArray(attemptQuestions.attemptId, ids))
    .orderBy(asc(attemptQuestions.position)) : [];
}

export type GradeRow = Awaited<ReturnType<typeof paperRows>>[number];

export function answered(response: AnswerResponse) {
  return typeof response === "string" ? Boolean(response.trim()) : Boolean(response?.length);
}

export function objectiveMarksCents(key: string[], response: AnswerResponse, marks: number, rule: ExamSettings["multiSelectRule"]) {
  const choices = Array.isArray(response) ? response : typeof response === "string" ? [response] : [];
  if (!key.length || !choices.length) return 0;
  const correct = new Set(key);
  const unique = new Set(choices);
  const hits = [...unique].filter((choice) => correct.has(choice)).length;
  const misses = unique.size - hits;
  if (rule === "all_or_nothing") return hits === key.length && misses === 0 ? marks * 100 : 0;
  if (rule === "partial" && misses) return 0;
  return Math.round(marks * 100 * Math.max(0, hits - (rule === "partial_negative" ? misses : 0)) / key.length);
}

export function mark(row: GradeRow, rule: ExamSettings["multiSelectRule"]) {
  if (row.zeroed) return 0;
  if (row.awardedCents !== null) return row.awardedCents;
  if (row.type === "written") return answered(row.response) ? null : 0;
  return objectiveMarksCents(row.key, row.response, row.marks, row.type === "single" ? "all_or_nothing" : rule);
}

export function groupPapers(rows: GradeRow[]) {
  const papers = new Map<string, GradeRow[]>();
  for (const row of rows) {
    const group = papers.get(row.attemptId) ?? [];
    group.push(row);
    papers.set(row.attemptId, group);
  }
  return papers;
}

function marksFor(attempt: Attempt, rows: GradeRow[]) {
  return rows.map((row) => mark(row, attempt.settings.multiSelectRule));
}

async function examSubmissions(db: GradeDb, examId: string) {
  return db.select({ attempt: attempts, candidate: users.name }).from(attempts)
    .innerJoin(users, eq(users.id, attempts.candidateId)).where(and(eq(attempts.examId, examId),
      eq(attempts.isSandbox, false), inArray(attempts.status, ["submitted", "auto_submitted", "graded"])))
    .orderBy(desc(attempts.submittedAt));
}

async function publicationObstacles(db: GradeDb, examId: string, papers: Iterable<GradeRow[]>) {
  const [review] = await db.select({ total: count() }).from(incidents)
    .innerJoin(attempts, eq(incidents.attemptId, attempts.id)).where(and(eq(attempts.examId, examId),
      eq(attempts.isSandbox, false), eq(incidents.reviewStatus, "unreviewed")));
  const [active] = await db.select({ total: count() }).from(attempts).where(and(eq(attempts.examId, examId),
    eq(attempts.isSandbox, false), eq(attempts.status, "in_progress")));
  const [pending] = await db.select({ total: count() }).from(reattemptRequests)
    .innerJoin(attempts, eq(reattemptRequests.attemptId, attempts.id)).where(and(eq(attempts.examId, examId),
      inArray(reattemptRequests.status, ["pending_examiner", "pending_admin"])));
  let ungraded = 0;
  for (const paper of papers) {
    ungraded += paper.filter((row) => row.type === "written" && answered(row.response) && !row.zeroed && row.awardedCents === null).length;
  }
  return { ungraded, unreviewed: review.total, inProgress: active.total, pendingRequests: pending.total };
}

export async function gradingQueue(examinerId: string, examId: string) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    await tx.update(attempts).set({ status: "auto_submitted", submittedAt: attempts.deadlineAt })
      .where(and(eq(attempts.examId, exam.id), eq(attempts.status, "in_progress"), expiredBy(new Date())));
    const rows = await examSubmissions(tx, exam.id);
    const papers = groupPapers(await paperRows(tx, rows.map(({ attempt }) => attempt.id)));
    const evidence = await tx.select({ attemptId: integrityEvents.attemptId, qid: integrityEvents.questionId, at: integrityEvents.at, meta: integrityEvents.meta })
      .from(integrityEvents).innerJoin(attempts, eq(integrityEvents.attemptId, attempts.id)).where(and(
        eq(attempts.examId, exam.id), eq(attempts.isSandbox, false), eq(integrityEvents.type, "paste_blocked"))).limit(2_000);
    const pastes = new Map<string, typeof evidence>();
    for (const item of evidence) {
      const key = item.attemptId + "/" + item.qid;
      const group = pastes.get(key) ?? [];
      group.push(item);
      pastes.set(key, group);
    }
    return {
      published: exam.resultsPublished,
      windowEnded: exam.endsAt <= new Date(),
      blockers: await publicationObstacles(tx, exam.id, papers.values()),
      attempts: rows.map(({ attempt, candidate }) => {
        const questions = papers.get(attempt.id) ?? [];
        const marks = marksFor(attempt, questions);
        return { id: attempt.id, candidate, status: attempt.status, submittedAt: attempt.submittedAt,
          score: marks.every((value) => value !== null) ? marks.reduce((sum, value) => sum + value, 0) / 100 : null,
          questions: questions.map((row, index) => ({
            ...row, awarded: marks[index] === null ? null : marks[index] / 100,
            blockedPastes: pastes.get(attempt.id + "/" + row.qid) ?? [],
          })),
        };
      }),
    };
  });
}

export async function gradeAnswer(actorId: string, attemptId: string, qid: string, input: { marks: number; feedback: string; reason?: string }, examId?: string) {
  return database().transaction(async (tx) => {
    const [ref] = await tx.select({ examId: attempts.examId }).from(attempts).where(eq(attempts.id, attemptId));
    if (!ref || (examId && examId !== ref.examId)) fail(403, "FORBIDDEN", "This attempt is unavailable.");
    const exam = await ownedExam(tx, actorId, ref.examId);
    if (Boolean(input.reason) !== exam.resultsPublished) {
      fail(409, "REGRADE_REQUIRED", exam.resultsPublished ? "A reason is required to regrade a published result." : "Publish results before using regrade.");
    }
    const [attempt] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for("update");
    if (attempt.isSandbox || !["submitted", "auto_submitted", "graded"].includes(attempt.status)) {
      fail(409, "ATTEMPT_NOT_GRADABLE", "Choose a submitted candidate attempt.");
    }
    const [question] = await tx.select().from(attemptQuestions).where(and(eq(attemptQuestions.attemptId, attemptId), eq(attemptQuestions.questionId, qid)));
    if (!question || (!input.reason && question.type !== "written")) fail(400, "INVALID_QUESTION", "Choose a written question from this attempt.");
    if (input.marks > question.marks) fail(400, "MARKS_OUT_OF_RANGE", `Enter at most ${question.marks} marks.`);
    const [before] = await tx.select({ marks: answers.awardedCents, feedback: answers.feedback }).from(answers)
      .where(and(eq(answers.attemptId, attemptId), eq(answers.questionId, qid)));
    const updated = { awardedCents: Math.round(input.marks * 100), feedback: input.feedback, graderId: actorId };
    await tx.insert(answers).values({ attemptId, questionId: qid, ...updated })
      .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: updated });
    const paper = await paperRows(tx, [attemptId]);
    const marks = marksFor(attempt, paper);
    const scoreCents = marks.some((value) => value === null) ? null : marks.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    if (scoreCents !== null) await tx.update(attempts).set({ scoreCents, status: "graded" }).where(eq(attempts.id, attempt.id));
    if (input.reason) await tx.insert(gradeNotices).values({ attemptId, questionId: qid });
    await audit(tx, actorId, input.reason ? "answer_regraded" : "answer_graded", "attempt", attemptId,
      { reason: input.reason, before, after: { questionId: qid, ...updated } });
    return { qid, marks: input.marks, score: scoreCents === null ? null : scoreCents / 100 };
  });
}

export async function publishResults(actorId: string, examId: string) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, actorId, examId);
    const now = new Date();
    if (exam.resultsPublished) return { published: true };
    if (exam.status !== "published" || now < exam.endsAt) fail(409, "EXAM_WINDOW_OPEN", "Publish results after the exam window closes.");
    await tx.update(attempts).set({ status: "auto_submitted", submittedAt: attempts.deadlineAt })
      .where(and(eq(attempts.examId, examId), eq(attempts.status, "in_progress"), expiredBy(now)));
    const rows = await examSubmissions(tx, examId);
    const papers = groupPapers(await paperRows(tx, rows.map(({ attempt }) => attempt.id)));
    const { ungraded, unreviewed, inProgress, pendingRequests } = await publicationObstacles(tx, examId, papers.values());
    if (ungraded || unreviewed || inProgress || pendingRequests) {
      fail(409, "PUBLICATION_BLOCKED", `${ungraded} written answers to grade, ${unreviewed} incidents to review, ${inProgress} active attempts, and ${pendingRequests} requests pending.`);
    }
    const scores = rows.map(({ attempt }) => ({ id: attempt.id,
      score: marksFor(attempt, papers.get(attempt.id) ?? []).reduce<number>((sum, value) => sum + (value ?? 0), 0) }));
    if (scores.length) await tx.execute(sql`update attempts set status = 'graded', score_cents = graded.score
      from jsonb_to_recordset(${JSON.stringify(scores)}::jsonb) graded(id uuid, score integer) where attempts.id = graded.id`);
    await tx.update(exams).set({ resultsPublished: true }).where(eq(exams.id, examId));
    await audit(tx, actorId, "results_published", "exam", examId, { after: { candidateCount: scores.length } });
    return { published: true, graded: scores.length };
  });
}

export async function candidateResults(candidateId: string) {
  const db = database();
  const rows = await db.select({ id: attempts.id, examId: exams.id, title: exams.title, totalMarks: exams.totalMarks,
    scoreCents: attempts.scoreCents, submittedAt: attempts.submittedAt, settings: attempts.settings })
    .from(attempts).innerJoin(exams, eq(attempts.examId, exams.id)).where(and(eq(attempts.candidateId, candidateId),
      eq(attempts.isSandbox, false), eq(attempts.status, "graded"), eq(exams.resultsPublished, true))).orderBy(desc(attempts.submittedAt));
  const ids = rows.map(({ id }) => id);
  const papers = groupPapers(await paperRows(db, ids));
  const notices = ids.length ? await db.select({ attemptId: gradeNotices.attemptId, qid: gradeNotices.questionId, at: gradeNotices.createdAt })
    .from(gradeNotices).where(inArray(gradeNotices.attemptId, ids)).orderBy(desc(gradeNotices.createdAt)) : [];
  return rows.map(({ scoreCents, settings, ...result }) => ({
    ...result, score: (scoreCents ?? 0) / 100,
    questions: (papers.get(result.id) ?? []).map((question) => {
      const points = mark(question, settings.multiSelectRule);
      return { position: question.position, marks: question.marks, awarded: points === null ? null : points / 100, feedback: question.feedback,
        regradedAt: notices.find((notice) => notice.attemptId === result.id && notice.qid === question.qid)?.at ?? null };
    }),
  }));
}
