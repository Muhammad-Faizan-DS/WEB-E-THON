import { and, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { activationKeys, attempts, attemptQuestions, enrollments, gaps, incidents, integrityEvents, reattemptRequests, snapshots } from "../../db/schema";
import type { eventInput } from "@/lib/contracts/operations";
import type { z } from "zod";
import { audit } from "./admin";
import type { Tx } from "./database";
import { fail } from "./errors";

type Attempt = typeof attempts.$inferSelect;
type Event = z.infer<typeof eventInput>;

const heartbeatToleranceMs = 25_000;
const awayGraceMs = 3_000;
export const normalSaveGrace = 5_000;
export const offlineSaveGrace = 120_000;
const departure = new Set(["fullscreen_exit", "visibility_hidden", "window_blur"]);

export function hadDeadlineGap(attempt: Attempt) {
  return Boolean(attempt.lastHeartbeatAt &&
    attempt.deadlineAt.getTime() - attempt.lastHeartbeatAt.getTime() >= heartbeatToleranceMs);
}

export function saveGrace(attempt: Attempt) {
  return hadDeadlineGap(attempt) ? offlineSaveGrace : normalSaveGrace;
}

export async function recordGap(tx: Tx, attempt: Attempt, now: Date) {
  if (!attempt.lastHeartbeatAt || now.getTime() - attempt.lastHeartbeatAt.getTime() < heartbeatToleranceMs) return;
  await tx.insert(gaps).values({ attemptId: attempt.id, startedAt: attempt.lastHeartbeatAt, endedAt: now })
    .onConflictDoUpdate({ target: [gaps.attemptId, gaps.startedAt], set: { endedAt: now } });
}

async function currentQid(tx: Tx, attempt: Attempt) {
  const [row] = await tx.select({ id: attemptQuestions.questionId }).from(attemptQuestions)
    .where(and(eq(attemptQuestions.attemptId, attempt.id), eq(attemptQuestions.position, attempt.currentIndex)));
  return row?.id;
}

export async function writeSignal(tx: Tx, attempt: Attempt, type: string, at: Date, details: {
  qid?: string; chars?: number; detail?: string; frames?: string[]; priority?: "low" | "review" | "priority";
} = {}) {
  const [existing] = await tx.select().from(incidents).where(and(eq(incidents.attemptId, attempt.id),
    eq(incidents.reviewStatus, "unreviewed"), gte(incidents.endedAt, new Date(at.getTime() - 60_000)),
    gte(incidents.startedAt, new Date(at.getTime() - 60_000)))).orderBy(desc(incidents.endedAt)).limit(1);
  const label = type.replaceAll("_", " ");
  const summary = existing ? (existing.summary.includes(label) ? existing.summary : `${existing.summary}; ${label}`) : label;
  const priority = existing?.priority === "priority" || details.priority === "priority" ? "priority"
    : existing?.priority === "review" || details.priority === "review" ? "review" : "low";
  const [incident] = existing
    ? await tx.update(incidents).set({ endedAt: at, summary, priority }).where(eq(incidents.id, existing.id)).returning()
    : await tx.insert(incidents).values({ attemptId: attempt.id, startedAt: at, endedAt: at, summary, priority }).returning();
  const [event] = await tx.insert(integrityEvents).values({ attemptId: attempt.id, incidentId: incident.id, type, at,
    questionId: details.qid ?? await currentQid(tx, attempt), meta: { chars: details.chars, detail: details.detail } }).returning();
  if (details.frames) await tx.insert(snapshots).values(details.frames.map((image, index) => ({ eventId: event.id, seq: index + 1, image })));
  return incident.id;
}

export async function voidAttempt(tx: Tx, attempt: Attempt, now: Date, adminAction = false) {
  if (attempt.status === "voided") return attempt;
  const changes = { status: "voided" as const, submittedAt: now, scoreCents: null, pendingIntegrityAt: null, reviewUntil: null };
  const [updated] = await tx.update(attempts).set(changes).where(eq(attempts.id, attempt.id)).returning();
  if (!attempt.enrollmentId || attempt.isSandbox) return updated;
  const [enrollment] = await tx.select().from(enrollments).where(eq(enrollments.id, attempt.enrollmentId)).for("update");
  if (!enrollment) return updated;
  const strikes = enrollment.strikes + 1;
  await tx.update(enrollments).set({ strikes, status: strikes >= 2 ? "blocked" : "pending_review" }).where(eq(enrollments.id, enrollment.id));
  await tx.update(activationKeys).set({ status: "revoked" }).where(and(eq(activationKeys.enrollmentId, enrollment.id), eq(activationKeys.status, "active")));
  if (strikes < 2) {
    await tx.insert(reattemptRequests).values({ attemptId: attempt.id, enrollmentId: enrollment.id,
      status: adminAction ? "pending_admin" : "pending_examiner" }).onConflictDoNothing();
  }
  await audit(tx, attempt.candidateId, "attempt_voided", "attempt", attempt.id, { after: { strikes } });
  return updated;
}

export async function settleDeparture(tx: Tx, attempt: Attempt, now: Date) {
  if (attempt.status !== "in_progress" || !attempt.pendingIntegrityAt || now >= attempt.deadlineAt ||
      now.getTime() < attempt.pendingIntegrityAt.getTime() + awayGraceMs) return attempt;
  if (attempt.settings.integrityMode === "strict") return voidAttempt(tx, attempt, now);
  if (attempt.settings.integrityMode !== "review" || attempt.reviewUntil) return attempt;
  const [updated] = await tx.update(attempts).set({ reviewUntil: new Date(now.getTime() + 30_000) })
    .where(eq(attempts.id, attempt.id)).returning();
  return updated;
}

export async function recordSignal(tx: Tx, attempt: Attempt, now: Date, input: Event) {
  if (input.qid) {
    const [question] = await tx.select({ seenAt: attemptQuestions.seenAt }).from(attemptQuestions)
      .where(and(eq(attemptQuestions.attemptId, attempt.id), eq(attemptQuestions.questionId, input.qid)));
    if (!question?.seenAt) fail(403, "QUESTION_UNAVAILABLE", "This question has not been released.");
  }
  const camera = input.type.startsWith("camera_");
  if ((input.frames && !camera) || (camera && !attempt.settings.cameraCheck)) fail(400, "INVALID_SIGNAL", "This signal is unavailable.");
  if (input.frames && input.frames.some((frame) => {
    const file = Buffer.from(frame.slice("data:image/jpeg;base64,".length), "base64");
    return file.length < 4 || file.length > 52_500 || file.readUInt16BE(0) !== 0xffd8 || file.readUInt16BE(file.length - 2) !== 0xffd9;
  })) fail(400, "INVALID_FRAME", "Send valid JPEG camera frames.");
  const [recent] = await tx.select({ total: count() }).from(integrityEvents).where(and(eq(integrityEvents.attemptId, attempt.id),
    gte(integrityEvents.at, new Date(now.getTime() - 60_000))));
  if (recent.total >= 120) fail(429, "SIGNAL_RATE_LIMIT", "Too many integrity events.");
  if (camera) {
    const [last] = await tx.select({ at: integrityEvents.at }).from(integrityEvents).where(and(eq(integrityEvents.attemptId, attempt.id),
      eq(integrityEvents.type, input.type), gte(integrityEvents.at, new Date(now.getTime() - 20_000)))).limit(1);
    if (last) return { accepted: false };
  }
  const [bursts] = input.frames ? await tx.select({ total: count() }).from(snapshots)
    .innerJoin(integrityEvents, eq(integrityEvents.id, snapshots.eventId))
    .where(and(eq(integrityEvents.attemptId, attempt.id), eq(snapshots.seq, 1))) : [];
  const activeDeparture = departure.has(input.type) && attempt.settings.integrityMode !== "standard";
  const incidentId = await writeSignal(tx, attempt, input.type, now, { qid: input.qid, chars: input.chars,
    frames: bursts && bursts.total < 20 ? input.frames : undefined, priority: activeDeparture ? "review" : "low" });
  if (activeDeparture && !attempt.pendingIntegrityAt) {
    await tx.update(attempts).set({ pendingIntegrityAt: now, integrityIncidentId: incidentId }).where(eq(attempts.id, attempt.id));
  } else if (input.type === "return" && attempt.pendingIntegrityAt && !attempt.reviewUntil) {
    await tx.update(attempts).set({ pendingIntegrityAt: null, integrityIncidentId: null }).where(eq(attempts.id, attempt.id));
  }
  return { accepted: true };
}

export async function explain(tx: Tx, attempt: Attempt, now: Date, explanation: string) {
  if (attempt.settings.integrityMode !== "review" || !attempt.reviewUntil) fail(409, "NO_REVIEW_HOLD", "There is no explanation to submit.");
  if (now < attempt.reviewUntil) fail(409, "REVIEW_WAIT", "Wait for the review pause to finish.");
  const [event] = await tx.insert(integrityEvents).values({ attemptId: attempt.id, incidentId: attempt.integrityIncidentId,
    questionId: await currentQid(tx, attempt), type: "candidate_explanation", at: now, meta: { detail: explanation } }).returning({ id: integrityEvents.id });
  await tx.update(attempts).set({ pendingIntegrityAt: null, reviewUntil: null, integrityIncidentId: null }).where(eq(attempts.id, attempt.id));
  return { id: event.id };
}

export const gapEligibleSql = sql`${attempts.lastHeartbeatAt} <= ${attempts.deadlineAt} - interval '25 seconds'`;

export const expiredBy = (now: Date) => or(
  and(lt(attempts.deadlineAt, new Date(now.getTime() - offlineSaveGrace)), gapEligibleSql),
  and(lt(attempts.deadlineAt, new Date(now.getTime() - normalSaveGrace)), sql`(${gapEligibleSql}) is not true`),
);

export async function reviewCounts(tx: Tx, attemptId: string) {
  const [row] = await tx.select({ total: count() }).from(incidents).where(and(eq(incidents.attemptId, attemptId),
    inArray(incidents.reviewStatus, ["unreviewed", "confirmed"])));
  return row.total;
}
