import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { activationKeys, attempts, enrollments, exams, reattemptRequests, users } from "../../db/schema";
import type { requestPatch } from "@/lib/contracts/operations";
import type { z } from "zod";
import { audit } from "./admin";
import type { Actor } from "./auth";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { voidAttempt } from "./integrity";
import { activeAdminIds, notify } from "./notifications";
import { createHmac, randomUUID } from "node:crypto";
import { hashKey } from "./paper";

export function reattemptKey(keyId: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required.");
  return createHmac("sha256", secret).update("secureexam:reattempt:").update(keyId).digest("hex").slice(0, 16).toUpperCase();
}

async function scheduleReplacement(tx: Tx, enrollmentId: string, now: Date) {
  const cooldownUntil = new Date(now.getTime() + 15 * 60_000);
  await tx.update(activationKeys).set({ status: "revoked" }).where(and(eq(activationKeys.enrollmentId, enrollmentId), eq(activationKeys.status, "active")));
  const id = randomUUID();
  const key = reattemptKey(id);
  await tx.insert(activationKeys).values({ id, enrollmentId, keyHash: hashKey(key), hint: key.slice(-2) });
  await tx.update(enrollments).set({ status: "cooldown", cooldownUntil }).where(eq(enrollments.id, enrollmentId));
  return cooldownUntil;
}

export async function listRequests(actor: Actor) {
  return database().select({
    id: reattemptRequests.id, status: reattemptRequests.status, examinerNote: reattemptRequests.examinerNote,
    adminReason: reattemptRequests.adminReason, createdAt: reattemptRequests.createdAt, exam: exams.title,
    candidate: users.name, attemptId: attempts.id, enrollmentId: reattemptRequests.enrollmentId,
  }).from(reattemptRequests).innerJoin(attempts, eq(reattemptRequests.attemptId, attempts.id))
    .innerJoin(exams, eq(attempts.examId, exams.id)).innerJoin(users, eq(attempts.candidateId, users.id))
    .where(actor.role === "examiner" ? eq(exams.examinerId, actor.id) : undefined)
    .orderBy(desc(reattemptRequests.createdAt)).limit(500);
}

export async function decideRequest(actor: Actor, input: z.infer<typeof requestPatch>) {
  if (input.action === "forward" ? actor.role !== "examiner" : actor.role !== "admin") {
    fail(403, "FORBIDDEN", "This role cannot perform that request decision.");
  }
  return database().transaction(async (tx) => {
    const [link] = await tx.select({ examId: attempts.examId, attemptId: attempts.id }).from(reattemptRequests)
      .innerJoin(attempts, eq(reattemptRequests.attemptId, attempts.id)).where(eq(reattemptRequests.id, input.id));
    if (!link) fail(404, "REQUEST_NOT_FOUND", "Request not found.");
    const [exam] = await tx.select().from(exams).where(eq(exams.id, link.examId)).for("update");
    if (actor.role === "examiner" && exam.examinerId !== actor.id) fail(403, "FORBIDDEN", "This exam is unavailable.");
    const [attempt] = await tx.select().from(attempts).where(eq(attempts.id, link.attemptId)).for("update");
    const [request] = await tx.select().from(reattemptRequests).where(eq(reattemptRequests.id, input.id)).for("update");
    if (input.action === "forward") {
      if (request.status !== "pending_examiner") fail(409, "REQUEST_CLOSED", "This request was already forwarded.");
      const [updated] = await tx.update(reattemptRequests).set({ status: "pending_admin", examinerNote: input.note })
        .where(eq(reattemptRequests.id, request.id)).returning();
      await audit(tx, actor.id, "request_forwarded", "reattempt", request.id, { reason: input.note });
      await notify(tx, await activeAdminIds(tx), { kind: "request", title: "Re-attempt request needs a decision", body: input.note, link: "/portal/admin/requests" });
      return updated;
    }
    if (request.status !== "pending_admin" || exam.resultsPublished) fail(409, "REQUEST_CLOSED", "This request can no longer be decided.");
    const now = new Date();
    if (input.action === "approve" && attempt.status !== "voided") await voidAttempt(tx, attempt, now, true);
    const [enrollment] = await tx.select().from(enrollments).where(eq(enrollments.id, request.enrollmentId)).for("update");
    const replacement = input.action === "approve" && enrollment.status !== "blocked";
    const cooldownUntil = replacement ? await scheduleReplacement(tx, enrollment.id, now) : null;
    if (!replacement && attempt.status === "voided" && enrollment.status !== "blocked") {
      await tx.update(enrollments).set({ status: "rejected", cooldownUntil: null }).where(eq(enrollments.id, enrollment.id));
    }
    const status = input.action === "approve" ? "approved" : "rejected";
    const [updated] = await tx.update(reattemptRequests).set({ status, adminId: actor.id, adminReason: input.reason, decidedAt: now })
      .where(eq(reattemptRequests.id, request.id)).returning();
    await audit(tx, actor.id, `request_${status}`, "reattempt", request.id, { reason: input.reason, after: { cooldownUntil } });
    return { ...updated, cooldownUntil };
  });
}

export async function unblock(actorId: string, enrollmentId: string, reason: string) {
  return database().transaction(async (tx) => {
    const [ref] = await tx.select({ examId: enrollments.examId }).from(enrollments).where(eq(enrollments.id, enrollmentId));
    if (!ref) fail(404, "ENROLLMENT_NOT_FOUND", "Enrollment not found.");
    const [exam] = await tx.select().from(exams).where(eq(exams.id, ref.examId)).for("update");
    const [row] = await tx.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).for("update");
    if (row.status !== "blocked" || exam.resultsPublished) fail(409, "CANNOT_UNBLOCK", "This enrollment cannot be unblocked.");
    await tx.update(enrollments).set({ strikes: 0 }).where(eq(enrollments.id, enrollmentId));
    const cooldownUntil = await scheduleReplacement(tx, enrollmentId, new Date());
    await audit(tx, actorId, "enrollment_unblocked", "enrollment", enrollmentId, { reason, after: { cooldownUntil } });
    return { id: enrollmentId, status: "cooldown", cooldownUntil };
  });
}

export async function blockedEnrollments() {
  return database().select({ id: enrollments.id, exam: exams.title, candidate: users.name, strikes: enrollments.strikes })
    .from(enrollments).innerJoin(exams, eq(enrollments.examId, exams.id)).innerJoin(users, eq(enrollments.candidateId, users.id))
    .where(eq(enrollments.status, "blocked")).limit(500);
}

export const recentAttemptCondition = sql`not exists (
  select 1 from attempts newer where newer.enrollment_id = ${attempts.enrollmentId} and newer.attempt_no > ${attempts.attemptNo}
)`;

export async function releaseCooldown() {
  await database().update(enrollments).set({ status: "active" })
    .where(and(inArray(enrollments.status, ["cooldown"]), sql`${enrollments.cooldownUntil} <= now()`));
}
