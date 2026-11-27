import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { announcementReads, announcements, answers, attempts, attemptQuestions, enrollments, examSections, exams, integrityEvents } from "../../db/schema";
import { type AnswerResponse, type AttemptState, type CandidateQuestion, type saveInput } from "@/lib/contracts/core";
import { type z } from "zod";
import { type Actor } from "./auth";
import { database, type Tx } from "./database";
import { ApiError, fail } from "./errors";
import { gradePracticeOnSubmit } from "./grading";
import { notify } from "./notifications";
import { newSessionId } from "./paper";
import { explain, expiredBy, normalSaveGrace, recordGap, recordSignal, reviewCounts, saveGrace, settleDeparture, writeSignal } from "./integrity";
import type { eventInput } from "@/lib/contracts/operations";

type Attempt = typeof attempts.$inferSelect;
type Action<T> = (tx: Tx, attempt: Attempt, now: Date) => Promise<T>;

async function withAttempt<T>(actor: Actor, attemptId: string, action: Action<T>) {
  const result = await database().transaction(async (tx) => {
    const [stored] = await tx.select().from(attempts).where(and(
      eq(attempts.id, attemptId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, actor.role === "examiner"),
    )).for("update");
    if (!stored) fail(403, "FORBIDDEN", "This attempt is unavailable.");
    const now = new Date();
    let attempt = await settleDeparture(tx, stored, now);
    if (attempt.status === "in_progress" && now.getTime() >= attempt.deadlineAt.getTime() + saveGrace(attempt)) {
      const [closed] = await tx.update(attempts).set({ status: "auto_submitted", submittedAt: attempt.deadlineAt })
        .where(eq(attempts.id, attempt.id)).returning();
      attempt = closed;
    }
    if (attempt === stored) return { data: await action(tx, attempt, now) };
    try {
      return { data: await tx.transaction((savepoint) => action(savepoint, attempt, now)) };
    } catch (error) {
      if (error instanceof ApiError) return { error };
      throw error;
    }
  });
  if ("error" in result && result.error) throw result.error;
  return result.data as T;
}

function assertSession(attempt: Attempt, sessionId: string) {
  if (attempt.activeSessionId !== sessionId) fail(409, "SESSION_SUPERSEDED", "This attempt is active in another window.");
}

function assertActive(attempt: Attempt, now: Date, graceMs = 0, allowHold = false) {
  if (attempt.status === "auto_submitted" || now.getTime() >= attempt.deadlineAt.getTime() + graceMs) {
    fail(409, "DEADLINE_PASSED", "The exam deadline has passed.");
  }
  if (attempt.status !== "in_progress") fail(409, "ATTEMPT_CLOSED", "This attempt is closed.");
  if (attempt.reviewUntil && !allowHold) fail(409, "REVIEW_REQUIRED", "Complete the integrity review prompt to continue.");
}

async function openLimit(tx: Tx, attempt: Attempt) {
  if (!attempt.enrollmentId) return attempt.settings.openLimit;
  const [row] = await tx.select({ override: enrollments.openLimitOverride, live: exams.liveOpenLimit }).from(enrollments)
    .innerJoin(exams, eq(enrollments.examId, exams.id)).where(eq(enrollments.id, attempt.enrollmentId));
  const limit = row?.override ?? row?.live ?? attempt.settings.openLimit;
  return limit === 0 ? null : limit;
}

function questionAnswerJoin() {
  return and(eq(attemptQuestions.attemptId, answers.attemptId), eq(attemptQuestions.questionId, answers.questionId));
}

async function state(tx: Tx, attempt: Attempt, includeSession = false): Promise<AttemptState> {
  const rows = await tx.select({
    position: attemptQuestions.position, sectionId: attemptQuestions.sectionId, seenAt: attemptQuestions.seenAt, lockedAt: attemptQuestions.lockedAt,
    response: answers.response, flagged: answers.flagged,
  }).from(attemptQuestions).leftJoin(answers, questionAnswerJoin())
    .where(eq(attemptQuestions.attemptId, attempt.id)).orderBy(asc(attemptQuestions.position));
  const palette = rows.map(({ position, sectionId, seenAt, lockedAt, response, flagged }) => ({
    position, sectionId, seen: Boolean(seenAt), locked: Boolean(lockedAt), flagged: flagged ?? false,
    answered: response !== null && response.length > 0,
  }));
  const sectionIds = [...new Set(rows.flatMap(({ sectionId }) => sectionId ? [sectionId] : []))];
  const details = sectionIds.length ? await tx.select({ id: examSections.id, title: examSections.title, instructions: examSections.instructions })
    .from(examSections).where(inArray(examSections.id, sectionIds)) : [];
  const sections = sectionIds.flatMap((id) => {
    const detail = details.find((item) => item.id === id);
    const members = palette.filter((item) => item.sectionId === id);
    return detail ? [{ ...detail, firstPosition: members[0].position, count: members.length }] : [];
  });
  return {
    id: attempt.id, examId: attempt.examId, status: attempt.status, startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(), submittedAt: attempt.submittedAt?.toISOString() ?? null, isSandbox: attempt.isSandbox,
    ...(includeSession ? { sessionId: attempt.activeSessionId } : {}),
    openLimit: await openLimit(tx, attempt), reviewUntil: attempt.reviewUntil?.toISOString() ?? null,
    integrityMode: attempt.settings.integrityMode, incidentCount: await reviewCounts(tx, attempt.id), currentIndex: attempt.currentIndex, totalQuestions: rows.length,
    openCount: palette.filter(({ seen, locked }) => seen && !locked).length, palette, sections,
  };
}

export function attemptState(actor: Actor, attemptId: string) {
  return withAttempt(actor, attemptId, (tx, attempt) => state(tx, attempt));
}

export function heartbeat(actor: Actor, attemptId: string, sessionId?: string) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    if (sessionId) assertSession(attempt, sessionId);
    if (attempt.status !== "in_progress") return state(tx, attempt);
    if (now >= attempt.deadlineAt) return state(tx, attempt);
    const activeSessionId = sessionId ?? newSessionId();
    await recordGap(tx, attempt, now);
    await tx.update(attempts).set({ activeSessionId, lastHeartbeatAt: now }).where(eq(attempts.id, attemptId));
    const news = await tx.select({ id: announcements.id, message: announcements.message, createdAt: announcements.createdAt,
      private: sql<boolean>`${announcements.targetCandidateId} is not null`, read: sql<boolean>`${announcementReads.readAt} is not null` })
      .from(announcements).leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id),
        eq(announcementReads.candidateId, attempt.candidateId)))
      .where(and(eq(announcements.examId, attempt.examId),
        or(isNull(announcements.targetCandidateId), eq(announcements.targetCandidateId, attempt.candidateId))))
      .orderBy(sql`${announcements.createdAt} desc`).limit(30);
    return { ...await state(tx, { ...attempt, activeSessionId }, true), announcements: news, handRaisedAt: attempt.handRaisedAt?.toISOString() ?? null };
  });
}

export function getQuestion(actor: Actor, attemptId: string, sessionId: string, position?: number) {
  return withAttempt<CandidateQuestion>(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    assertActive(attempt, now);
    const [row] = await tx.select({
      id: attemptQuestions.questionId, position: attemptQuestions.position, sectionId: attemptQuestions.sectionId, type: attemptQuestions.type,
      text: attemptQuestions.text, marks: attemptQuestions.marks, options: attemptQuestions.options,
      seenAt: attemptQuestions.seenAt, lockedAt: attemptQuestions.lockedAt,
      response: answers.response, seq: answers.seq, flagged: answers.flagged,
    }).from(attemptQuestions).leftJoin(answers, questionAnswerJoin()).where(and(
      eq(attemptQuestions.attemptId, attemptId), eq(attemptQuestions.position, position ?? attempt.currentIndex),
    ));
    if (!row?.seenAt) fail(403, "QUESTION_UNAVAILABLE", "This question has not been released.");
    const { id, type, text, marks, options } = row;
    return { id, position: row.position, sectionId: row.sectionId, type, text, marks, options, response: row.response, seq: row.seq ?? 0,
      locked: Boolean(row.lockedAt), flagged: row.flagged ?? false };
  });
}

export function nextQuestion(actor: Actor, attemptId: string, sessionId: string) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    assertActive(attempt, now);
    const current = await state(tx, attempt);
    const position = attempt.currentIndex + 1;
    if (position > current.totalQuestions) fail(409, "NO_NEXT_QUESTION", "There are no more questions.");
    if (attempt.settings.sequentialReveal && current.openLimit !== null && current.openCount >= current.openLimit) {
      fail(409, "OPEN_LIMIT_REACHED", `You have ${current.openCount} open questions. Lock at least one to continue.`);
    }
    if (attempt.settings.sequentialReveal) {
      await tx.update(attemptQuestions).set({ seenAt: now }).where(and(
        eq(attemptQuestions.attemptId, attemptId), eq(attemptQuestions.position, position),
      ));
    }
    await tx.update(attempts).set({ currentIndex: position }).where(eq(attempts.id, attemptId));
    return state(tx, { ...attempt, currentIndex: position });
  });
}

async function seenQuestion(tx: Tx, attemptId: string, questionId: string) {
  const [question] = await tx.select().from(attemptQuestions).where(and(
    eq(attemptQuestions.attemptId, attemptId), eq(attemptQuestions.questionId, questionId),
  ));
  if (!question?.seenAt) fail(403, "QUESTION_UNAVAILABLE", "This question has not been released.");
  return question;
}

function rightResponse(question: typeof attemptQuestions.$inferSelect, response: AnswerResponse) {
  if (response === null) return true;
  switch (question.type) {
    case "written": return typeof response === "string";
    case "single": return typeof response === "string" && question.options.some(({ id }) => id === response);
    case "multi": return Array.isArray(response) && new Set(response).size === response.length
      && response.every((choice) => question.options.some(({ id }) => id === choice));
  }
}

export function saveAnswers(actor: Actor, attemptId: string, input: z.infer<typeof saveInput>) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, input.sessionId);
    assertActive(attempt, now, saveGrace(attempt));
    const saved = [];
    for (const { qid, response, seq } of input.answers) {
      const question = await seenQuestion(tx, attemptId, qid);
      if (question.lockedAt) fail(409, "QUESTION_LOCKED", "A locked answer cannot be changed.");
      if (!rightResponse(question, response)) fail(400, "INVALID_ANSWER", "The response does not match the question.");
      const edit = question.type === "written" ? [{ at: now.toISOString(), chars: typeof response === "string" ? response.length : 0 }] : [];
      await tx.insert(answers).values({ attemptId, questionId: qid, response, seq, savedAt: now, editTimeline: edit }).onConflictDoUpdate({
        target: [answers.attemptId, answers.questionId], set: { response, seq, savedAt: now,
          ...(edit.length ? { editTimeline: sql`case when jsonb_array_length(${answers.editTimeline}) >= 120 then (${answers.editTimeline} - 0) || ${JSON.stringify(edit)}::jsonb else ${answers.editTimeline} || ${JSON.stringify(edit)}::jsonb end` } : {}) },
        setWhere: lte(answers.seq, seq - 1),
      });
      saved.push({ qid, seq });
    }
    if (now.getTime() >= attempt.deadlineAt.getTime() + normalSaveGrace) {
      await recordGap(tx, attempt, now);
      const [logged] = await tx.select({ id: integrityEvents.id }).from(integrityEvents).where(and(
        eq(integrityEvents.attemptId, attempt.id), eq(integrityEvents.type, "late_offline_save"))).limit(1);
      if (!logged) await writeSignal(tx, attempt, "late_offline_save", now, { priority: "review" });
    }
    return { saved };
  });
}

export function lockAnswer(actor: Actor, attemptId: string, questionId: string, sessionId: string) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    assertActive(attempt, now);
    const question = await seenQuestion(tx, attemptId, questionId);
    if (!question.lockedAt) {
      await tx.update(attemptQuestions).set({ lockedAt: now }).where(and(
        eq(attemptQuestions.attemptId, attemptId), eq(attemptQuestions.questionId, questionId),
      ));
    }
    return { qid: questionId, locked: true };
  });
}

export function flagAnswer(actor: Actor, attemptId: string, questionId: string, sessionId: string, flagged: boolean) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    assertActive(attempt, now);
    await seenQuestion(tx, attemptId, questionId);
    await tx.insert(answers).values({ attemptId, questionId, flagged }).onConflictDoUpdate({
      target: [answers.attemptId, answers.questionId], set: { flagged },
    });
    return { qid: questionId, flagged };
  });
}

export function submitAttempt(actor: Actor, attemptId: string, sessionId: string) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    if (attempt.status === "voided") fail(409, "ATTEMPT_CLOSED", "This attempt is closed.");
    if (attempt.status !== "in_progress") return state(tx, attempt);
    if (now < attempt.deadlineAt) assertActive(attempt, now);
    const status = now >= attempt.deadlineAt ? "auto_submitted" : "submitted";
    const submittedAt = status === "auto_submitted" ? attempt.deadlineAt : now;
    await tx.update(attempts).set({ status, submittedAt }).where(and(eq(attempts.id, attemptId), eq(attempts.status, "in_progress")));
    const result = await gradePracticeOnSubmit(tx, { ...attempt, status, submittedAt });
    const after = await state(tx, { ...attempt, status: result ? "graded" : status, submittedAt });
    return result ? { ...after, result } : after;
  });
}

export async function sweepExpired() {
  const updated = await database().update(attempts).set({ status: "auto_submitted", submittedAt: attempts.deadlineAt })
    .where(and(eq(attempts.status, "in_progress"), expiredBy(new Date()))).returning({ id: attempts.id });
  return { finalized: updated.length };
}

export function submitSignal(actor: Actor, attemptId: string, input: z.infer<typeof eventInput>) {
  return withAttempt(actor, attemptId, (tx, attempt, now) => {
    assertSession(attempt, input.sessionId);
    assertActive(attempt, now, 0, true);
    return recordSignal(tx, attempt, now, input);
  });
}

export function submitExplanation(actor: Actor, attemptId: string, sessionId: string, explanation: string) {
  return withAttempt(actor, attemptId, (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    assertActive(attempt, now, 0, true);
    return explain(tx, attempt, now, explanation);
  });
}

export function checkViolation(actor: Actor, attemptId: string, sessionId: string) {
  return withAttempt(actor, attemptId, (tx, attempt) => {
    assertSession(attempt, sessionId);
    return state(tx, attempt);
  });
}

/** "Ask examiner" (raised hand). The examiner sees it on the candidate's tile and replies with a private message. */
export function raiseHand(actor: Actor, attemptId: string, sessionId: string, raised: boolean, message?: string) {
  return withAttempt(actor, attemptId, async (tx, attempt, now) => {
    assertSession(attempt, sessionId);
    assertActive(attempt, now, 0, true);
    await tx.update(attempts).set(raised ? { handRaisedAt: now, handMessage: message || null } : { handRaisedAt: null, handMessage: null })
      .where(eq(attempts.id, attemptId));
    if (raised && !attempt.handRaisedAt) {
      const [exam] = await tx.select({ examinerId: exams.examinerId, title: exams.title }).from(exams).where(eq(exams.id, attempt.examId));
      await notify(tx, [exam.examinerId], { kind: "hand", title: `A candidate asked for help · ${exam.title}`, body: message ?? "",
        link: `/portal/examiner/exams/${attempt.examId}?tab=monitor` });
    }
    return { raised, handRaisedAt: raised ? now.toISOString() : null };
  });
}
