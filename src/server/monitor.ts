import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { activationKeys, announcements, answers, attempts, attemptQuestions, enrollments, exams, gaps, incidents, integrityEvents, reattemptRequests, snapshots, users } from "../../db/schema";
import type { cameraExceptionInput, incidentReview, liveLimitInput, announcementInput } from "@/lib/contracts/operations";
import type { z } from "zod";
import { audit } from "./admin";
import type { Actor } from "./auth";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { ownedExam } from "./exams";
import { expiredBy } from "./integrity";

export async function monitor(actor: Actor, examId: string) {
  const db = database();
  const [exam] = await db.select({ id: exams.id, totalMarks: exams.totalMarks, resultsPublished: exams.resultsPublished }).from(exams).where(and(eq(exams.id, examId), actor.role === "examiner" ? eq(exams.examinerId, actor.id) : undefined));
  if (!exam) fail(403, "FORBIDDEN", "This exam is unavailable.");
  await db.update(attempts).set({ status: "auto_submitted", submittedAt: attempts.deadlineAt })
    .where(and(eq(attempts.examId, exam.id), eq(attempts.status, "in_progress"), expiredBy(new Date())));
  const relevant = and(eq(attempts.examId, examId), eq(attempts.isSandbox, false));
  const [live, flags, logs, alerts, news] = await Promise.all([
    db.select({
      id: attempts.id, candidate: users.name, status: attempts.status, deadlineAt: attempts.deadlineAt, lastHeartbeatAt: attempts.lastHeartbeatAt,
      timeCreditSec: attempts.timeCreditSec, scoreCents: attempts.scoreCents,
      openCount: sql<number>`(select count(*)::int from attempt_questions q where q.attempt_id = ${attempts.id} and q.seen_at is not null and q.locked_at is null)`,
      seen: sql<number>`(select count(*)::int from attempt_questions q where q.attempt_id = ${attempts.id} and q.seen_at is not null)`,
      answered: sql<number>`(select count(*)::int from answers a where a.attempt_id = ${attempts.id} and a.response is not null and a.response not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb))`,
      gapSeconds: sql<number>`(select coalesce(sum(floor(extract(epoch from g.ended_at - g.started_at))), 0)::int from heartbeat_gaps g where g.attempt_id = ${attempts.id})`,
    }).from(attempts).innerJoin(users, eq(users.id, attempts.candidateId)).where(relevant).orderBy(desc(attempts.startedAt)).limit(500),
    db.select({ incident: incidents, candidate: users.name }).from(incidents).innerJoin(attempts, eq(incidents.attemptId, attempts.id))
      .innerJoin(users, eq(attempts.candidateId, users.id)).where(relevant).orderBy(desc(incidents.endedAt)).limit(250),
    db.select({ attemptId: gaps.attemptId, startedAt: gaps.startedAt, endedAt: gaps.endedAt }).from(gaps)
      .innerJoin(attempts, eq(attempts.id, gaps.attemptId)).where(relevant).orderBy(desc(gaps.endedAt)).limit(250),
    db.select({ candidate: users.name, enrollmentId: enrollments.id, failedTries: activationKeys.failedTries, issuedAt: activationKeys.issuedAt })
      .from(activationKeys).innerJoin(enrollments, eq(enrollments.id, activationKeys.enrollmentId))
      .innerJoin(users, eq(users.id, enrollments.candidateId))
      .where(and(eq(enrollments.examId, examId), eq(activationKeys.status, "locked"))).orderBy(desc(activationKeys.issuedAt)).limit(100),
    db.select().from(announcements).where(eq(announcements.examId, examId)).orderBy(desc(announcements.createdAt)).limit(30),
  ]);
  const events = flags.length ? await db.select({ id: integrityEvents.id, incidentId: integrityEvents.incidentId, type: integrityEvents.type,
    qid: integrityEvents.questionId, questionNumber: attemptQuestions.position, at: integrityEvents.at, meta: integrityEvents.meta })
    .from(integrityEvents).leftJoin(attemptQuestions, and(eq(attemptQuestions.attemptId, integrityEvents.attemptId),
      eq(attemptQuestions.questionId, integrityEvents.questionId)))
    .where(inArray(integrityEvents.incidentId, flags.map(({ incident }) => incident.id))).orderBy(asc(integrityEvents.at)).limit(2_000) : [];
  const ids = events.map(({ id }) => id);
  const frames = ids.length ? await db.select({ id: snapshots.id, eventId: snapshots.eventId, seq: snapshots.seq })
    .from(snapshots).where(inArray(snapshots.eventId, ids)).orderBy(asc(snapshots.seq)) : [];
  return { attempts: live.map(({ scoreCents, ...row }) => ({ ...row, score: scoreCents !== null && exam.resultsPublished ? scoreCents / 100 : null })), totalMarks: exam.totalMarks, incidents: flags.map(({ incident, candidate }) => ({ ...incident, candidate })), events, frames, gaps: logs, keyAlerts: alerts, announcements: news };
}

async function lockOwnedAttempt(tx: Tx, examiner: string, id: string) {
  const [ref] = await tx.select({ examId: attempts.examId }).from(attempts).where(eq(attempts.id, id));
  if (!ref) fail(403, "FORBIDDEN", "This attempt is unavailable.");
  const exam = await ownedExam(tx, examiner, ref.examId);
  const [attempt] = await tx.select().from(attempts).where(and(eq(attempts.id, id), eq(attempts.isSandbox, false))).for("update");
  if (!attempt) fail(403, "FORBIDDEN", "This attempt is unavailable.");
  return { exam, attempt };
}

export function postAnnouncement(actor: Actor, examId: string, input: z.infer<typeof announcementInput>) {
  return database().transaction(async (tx) => {
    await ownedExam(tx, actor.id, examId);
    if (input.candidateId) {
      const [member] = await tx.select({ id: enrollments.id }).from(enrollments)
        .where(and(eq(enrollments.examId, examId), eq(enrollments.candidateId, input.candidateId)));
      if (!member) fail(400, "NOT_ENROLLED", "Choose an enrolled candidate.");
    }
    const [row] = await tx.insert(announcements).values({ examId, targetCandidateId: input.candidateId, message: input.message }).returning();
    await audit(tx, actor.id, "announcement_sent", "exam", examId, { after: { announcementId: row.id } });
    return row;
  });
}

export function grantCredit(actor: Actor, id: string, seconds: number) {
  return database().transaction(async (tx) => {
    const { exam, attempt } = await lockOwnedAttempt(tx, actor.id, id);
    const now = Date.now();
    if (attempt.status !== "in_progress" || now >= attempt.deadlineAt.getTime() || now >= exam.endsAt.getTime()) {
      fail(409, "ATTEMPT_CLOSED", "Grant time credit while the attempt is active.");
    }
    const [logged] = await tx.select({ seconds: sql<number>`coalesce(sum(floor(extract(epoch from ${gaps.endedAt} - ${gaps.startedAt}))), 0)::int` })
      .from(gaps).where(eq(gaps.attemptId, id));
    const capped = Math.min(logged.seconds, exam.durationMin * 15) - attempt.timeCreditSec;
    if (seconds > capped) fail(400, "TIME_CREDIT_LIMIT", `Available time credit is ${Math.max(0, capped)} seconds.`);
    const deadlineAt = new Date(Math.min(exam.endsAt.getTime(), attempt.deadlineAt.getTime() + seconds * 1_000));
    const added = Math.floor((deadlineAt.getTime() - attempt.deadlineAt.getTime()) / 1_000);
    if (added < 1) fail(409, "WINDOW_CAP", "Extend the exam window before granting time credit.");
    const next = { deadlineAt, timeCreditSec: attempt.timeCreditSec + added };
    await tx.update(attempts).set(next).where(eq(attempts.id, id));
    await audit(tx, actor.id, "time_credit_granted", "attempt", id, { before: { deadlineAt: attempt.deadlineAt }, after: next });
    return next;
  });
}

export function raiseLimit(actor: Actor, id: string, input: z.infer<typeof liveLimitInput>) {
  return database().transaction(async (tx) => {
    const { exam, attempt } = await lockOwnedAttempt(tx, actor.id, id);
    if (!attempt.enrollmentId || attempt.status !== "in_progress" || new Date() >= attempt.deadlineAt) fail(409, "ATTEMPT_CLOSED", "Choose an active attempt.");
    const [enrollment] = await tx.select().from(enrollments).where(eq(enrollments.id, attempt.enrollmentId));
    const current = (input.all ? null : enrollment.openLimitOverride) ?? exam.liveOpenLimit ?? exam.settings.openLimit;
    if (input.openLimit !== null && (current === null || current === 0 || input.openLimit <= current)) {
      fail(400, "LIMIT_NOT_RAISED", "Pick a higher open-question limit or unlimited.");
    }
    const value = input.openLimit ?? 0;
    if (input.all) {
      await tx.update(exams).set({ liveOpenLimit: value }).where(eq(exams.id, exam.id));
      await tx.update(enrollments).set({ openLimitOverride: null }).where(and(eq(enrollments.examId, exam.id),
        sql`${enrollments.openLimitOverride} > 0 and (${value} = 0 or ${enrollments.openLimitOverride} < ${value})`));
    } else await tx.update(enrollments).set({ openLimitOverride: value }).where(eq(enrollments.id, enrollment.id));
    await audit(tx, actor.id, "open_limit_raised", input.all ? "exam" : "attempt", input.all ? exam.id : id, { after: { limit: input.openLimit } });
    return { openLimit: input.openLimit };
  });
}

export function setCameraException(actor: Actor, examId: string, input: z.infer<typeof cameraExceptionInput>) {
  return database().transaction(async (tx) => {
    await ownedExam(tx, actor.id, examId);
    const [row] = await tx.update(enrollments).set({ cameraException: input.enabled })
      .where(and(eq(enrollments.examId, examId), eq(enrollments.id, input.enrollmentId))).returning({ id: enrollments.id });
    if (!row) fail(404, "ENROLLMENT_NOT_FOUND", "Enrollment not found.");
    await audit(tx, actor.id, "camera_exception_updated", "enrollment", row.id, { reason: input.reason, after: { enabled: input.enabled } });
    return { id: row.id, enabled: input.enabled };
  });
}

export function decideIncident(actor: Actor, id: string, input: z.infer<typeof incidentReview>) {
  return database().transaction(async (tx) => {
    const [ref] = await tx.select({ examId: attempts.examId, attemptId: attempts.id }).from(incidents)
      .innerJoin(attempts, eq(incidents.attemptId, attempts.id)).where(eq(incidents.id, id));
    if (!ref) fail(404, "INCIDENT_NOT_FOUND", "Incident not found.");
    const [exam] = await tx.select().from(exams).where(eq(exams.id, ref.examId)).for("update");
    if (actor.role === "examiner" && exam.examinerId !== actor.id) fail(403, "FORBIDDEN", "This exam is unavailable.");
    if (exam.resultsPublished) fail(409, "RESULTS_PUBLISHED", "Review incidents before publishing results.");
    const [attempt] = await tx.select().from(attempts).where(and(eq(attempts.id, ref.attemptId), eq(attempts.isSandbox, false))).for("update");
    if (!attempt) fail(403, "FORBIDDEN", "This incident is unavailable.");
    const [incident] = await tx.select().from(incidents).where(eq(incidents.id, id)).for("update");
    if (incident.reviewStatus !== "unreviewed") fail(409, "INCIDENT_REVIEWED", "This incident has already been reviewed.");
    if (input.status === "confirmed" && input.outcome === "zero_question") {
      if (attempt.status === "in_progress" || attempt.status === "voided") fail(409, "ATTEMPT_NOT_GRADABLE", "Choose a submitted attempt.");
      if (!input.qid) fail(400, "QUESTION_REQUIRED", "Select the question identified by the incident.");
      const [signal] = await tx.select({ total: count() }).from(integrityEvents)
        .where(and(eq(integrityEvents.incidentId, id), eq(integrityEvents.questionId, input.qid)));
      if (!signal.total) fail(400, "QUESTION_REQUIRED", "Select a question identified by this incident.");
      await tx.insert(answers).values({ attemptId: attempt.id, questionId: input.qid, zeroed: true })
        .onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { zeroed: true } });
      await tx.update(attempts).set({ scoreCents: null }).where(eq(attempts.id, attempt.id));
    }
    if (input.status === "confirmed" && input.outcome === "escalate_void") {
      if (!attempt.enrollmentId || attempt.status === "voided") fail(409, "CANNOT_ESCALATE", "This attempt already has a final integrity decision.");
      await tx.insert(reattemptRequests).values({ attemptId: attempt.id, enrollmentId: attempt.enrollmentId,
        status: "pending_admin", examinerNote: input.note }).onConflictDoNothing();
    }
    const [row] = await tx.update(incidents).set({ reviewStatus: input.status, reviewerId: actor.id, note: input.note,
      outcome: input.status === "confirmed" ? input.outcome : null }).where(eq(incidents.id, id)).returning();
    await audit(tx, actor.id, "incident_reviewed", "incident", id, { reason: input.note, after: { status: row.reviewStatus, outcome: row.outcome } });
    return row;
  });
}

export async function readSnapshot(actor: Actor, id: string) {
  const [row] = await database().select({ image: snapshots.image }).from(snapshots)
    .innerJoin(integrityEvents, eq(snapshots.eventId, integrityEvents.id)).innerJoin(attempts, eq(integrityEvents.attemptId, attempts.id))
    .innerJoin(exams, eq(attempts.examId, exams.id)).where(and(eq(snapshots.id, id), eq(attempts.isSandbox, false),
      actor.role === "examiner" ? eq(exams.examinerId, actor.id) : undefined));
  if (!row) fail(404, "FRAME_NOT_FOUND", "Camera frame not found.");
  return row.image;
}
