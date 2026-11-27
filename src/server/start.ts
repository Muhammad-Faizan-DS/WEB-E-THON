import { and, asc, desc, eq } from "drizzle-orm";
import { activationKeys, attempts, attemptQuestions, auditLog, enrollments, exams, reattemptRequests } from "../../db/schema";
import { type startInput } from "@/lib/contracts/core";
import { type z } from "zod";
import { type Actor } from "./auth";
import { database } from "./database";
import { fail } from "./errors";
import { examPool, paperSections } from "./exams";
import { checkPaper, drawPaper, hashKey, keyMatches, newSessionId, paperSeed, reattemptIssues } from "./paper";
import { reattemptKey, recentAttemptCondition } from "./requests";

export function requireDesktop(deviceCheck: boolean, headers: Headers) {
  if (!deviceCheck || headers.get("sec-ch-ua-mobile") === "?1" ||
      /android|mobile|iphone|ipad|ipod|windows phone/i.test(headers.get("user-agent") ?? "")) {
    fail(403, "DESKTOP_REQUIRED", "Use a desktop or laptop computer to take this exam.");
  }
}

export function deadline(startedAt: Date, endsAt: Date, durationMin: number, multiplier: number) {
  return new Date(Math.min(endsAt.getTime(), startedAt.getTime() + Math.round(durationMin * multiplier * 60_000)));
}

export async function candidateExams(candidateId: string) {
  const now = new Date();
  const rows = await database().select({
    id: exams.id, title: exams.title, examType: exams.examType, instructions: exams.instructions, startsAt: exams.startsAt, endsAt: exams.endsAt,
    durationMin: exams.durationMin, timeMultiplier: enrollments.timeMultiplier, accessStatus: enrollments.status,
    allowPaste: enrollments.allowPaste, cameraCheck: exams.settings,
    cameraException: enrollments.cameraException,
    attemptId: attempts.id, attemptStatus: attempts.status, cooldownUntil: enrollments.cooldownUntil,
    requestStatus: reattemptRequests.status, requestReason: reattemptRequests.adminReason,
    replacementId: activationKeys.id, replacementHash: activationKeys.keyHash,
  }).from(enrollments).innerJoin(exams, eq(exams.id, enrollments.examId))
    .leftJoin(attempts, and(eq(attempts.enrollmentId, enrollments.id), recentAttemptCondition))
    .leftJoin(reattemptRequests, eq(reattemptRequests.attemptId, attempts.id))
    .leftJoin(activationKeys, and(eq(activationKeys.enrollmentId, enrollments.id), eq(activationKeys.status, "active")))
    .where(and(eq(enrollments.candidateId, candidateId), eq(exams.status, "published"))).orderBy(asc(exams.startsAt));
  const buckets = { available: [] as unknown[], upcoming: [] as unknown[], completed: [] as unknown[] };
  for (const { cameraCheck, cameraException, replacementId, replacementHash, ...row } of rows) {
    const replacementReady = Boolean(row.cooldownUntil && row.cooldownUntil <= now && row.attemptStatus === "voided" &&
      (row.accessStatus === "cooldown" || row.accessStatus === "active"));
    const replacement = replacementReady && replacementId ? reattemptKey(replacementId) : null;
    const bucket = row.startsAt > now ? "upcoming" :
      row.endsAt <= now || (row.attemptStatus && row.attemptStatus !== "in_progress" && row.attemptStatus !== "voided") ? "completed" : "available";
    buckets[bucket].push({
      ...row,
      accessStatus: replacementReady ? "active" : row.accessStatus,
      reattemptKey: replacement && replacementHash && hashKey(replacement) === replacementHash ? replacement : null,
      cameraCheck: cameraCheck.cameraCheck && !cameraException,
      integrityMode: cameraCheck.integrityMode,
      keyRequired: row.examType !== "practice",
      availableSeconds: bucket === "available" ? Math.max(0, Math.floor(
        (deadline(now, row.endsAt, row.durationMin, row.timeMultiplier).getTime() - now.getTime()) / 1_000,
      )) : 0,
    });
  }
  return buckets;
}

export async function startAttempt(actor: Actor, examId: string, input: z.infer<typeof startInput>, headers: Headers) {
  requireDesktop(input.deviceCheck, headers);
  const sandbox = input.sandbox;
  if (sandbox ? actor.role !== "examiner" : actor.role !== "candidate") {
    fail(403, "FORBIDDEN", "This role cannot start the requested attempt.");
  }
  const result = await database().transaction(async (tx) => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for("update");
    if (!exam || (sandbox && exam.examinerId !== actor.id)) fail(403, "FORBIDDEN", "This exam is unavailable.");
    const now = new Date();
    let enrollment: typeof enrollments.$inferSelect | undefined;
    let key: typeof activationKeys.$inferSelect | undefined;
    let previous: typeof attempts.$inferSelect | undefined;
    const settings = exam.settings;
    if (!input.sandbox) {
      [enrollment] = await tx.select().from(enrollments)
        .where(and(eq(enrollments.examId, examId), eq(enrollments.candidateId, actor.id))).for("update");
      if (!enrollment) fail(403, "FORBIDDEN", "This exam is unavailable.");
      if (exam.status !== "published" || now < exam.startsAt || now >= exam.endsAt) {
        fail(409, "EXAM_WINDOW_CLOSED", "This exam cannot be started right now.");
      }
      const cooldownDone = enrollment.status === "cooldown" && enrollment.cooldownUntil && enrollment.cooldownUntil <= now;
      if ((!cooldownDone && enrollment.status !== "active") || (enrollment.cooldownUntil && enrollment.cooldownUntil > now)) {
        fail(409, "ENROLLMENT_UNAVAILABLE", "This enrollment is unavailable.");
      }
      [previous] = await tx.select().from(attempts).where(eq(attempts.enrollmentId, enrollment.id)).orderBy(desc(attempts.attemptNo)).limit(1);
      if (previous && (previous.status !== "voided" || !enrollment.cooldownUntil)) {
        fail(409, "ATTEMPT_EXISTS", "Open your existing attempt from the candidate dashboard.");
      }
      if (settings.cameraCheck && !enrollment.cameraException && !input.cameraReady) fail(409, "CAMERA_CHECK_REQUIRED", "Complete the camera check before starting.");
      if (cooldownDone) await tx.update(enrollments).set({ status: "active" }).where(eq(enrollments.id, enrollment.id));
      // Practice exams open without a key (PRD §24.3 preset); every other exam needs the candidate's own key.
      if (exam.examType !== "practice") {
        [key] = await tx.select().from(activationKeys)
          .where(and(eq(activationKeys.enrollmentId, enrollment.id), eq(activationKeys.status, "active"))).for("update");
        if (!key) fail(403, "KEY_UNAVAILABLE", "Request an active activation key from your examiner.");
        if (!input.key) fail(400, "KEY_REQUIRED", "Enter your activation key to start this exam.");
        if (!keyMatches(input.key, key.keyHash)) {
          const count = key.failedTries + 1;
          const locked = count >= 5;
          await tx.update(activationKeys).set({ failedTries: count, status: locked ? "locked" : "active" }).where(eq(activationKeys.id, key.id));
          if (locked) await tx.insert(auditLog).values({ actorId: actor.id, action: "activation_key_locked", entity: "enrollment", entityId: enrollment.id });
          return { rejected: locked ? "KEY_LOCKED" : "INVALID_KEY" } as const;
        }
      }
    }

    const pool = await examPool(tx, exam);
    const sections = await paperSections(tx, exam);
    const issues = checkPaper(pool, sections, exam.totalMarks);
    if (previous) issues.push(...reattemptIssues(pool, sections));
    if (issues.length > 0) fail(409, "PUBLISH_CHECKLIST_FAILED", issues.join(" "));
    const startedAt = new Date();
    if (!sandbox && startedAt >= exam.endsAt) fail(409, "EXAM_WINDOW_CLOSED", "This exam cannot be started right now.");
    const [attempt] = await tx.insert(attempts).values({
      examId, candidateId: actor.id, enrollmentId: enrollment?.id, isSandbox: sandbox, attemptNo: (previous?.attemptNo ?? 0) + 1,
      startedAt, deadlineAt: sandbox ? new Date(startedAt.getTime() + exam.durationMin * 60_000) : deadline(startedAt, exam.endsAt, exam.durationMin, enrollment?.timeMultiplier ?? 1),
      activeSessionId: newSessionId(), lastHeartbeatAt: startedAt,
      settings,
    }).returning();
    const oldQuestions = previous ? await tx.select({ id: attemptQuestions.questionId }).from(attemptQuestions)
      .where(eq(attemptQuestions.attemptId, previous.id)) : null;
    // The verified activation key seeds this candidate's paper; sandbox and practice papers use a fresh random seed.
    const paper = drawPaper(pool, settings, { sections, previous: oldQuestions ? new Set(oldQuestions.map(({ id }) => id)) : undefined,
      seed: key && !input.sandbox && input.key ? paperSeed(input.key) : undefined });
    await tx.insert(attemptQuestions).values(paper.map((question) => ({
      ...question, attemptId: attempt.id, seenAt: question.position === 1 || !settings.sequentialReveal ? startedAt : null,
    })));
    if (key) await tx.update(activationKeys).set({ status: "used", usedAt: startedAt }).where(eq(activationKeys.id, key.id));
    if (!sandbox && !exam.frozenAt) await tx.update(exams).set({ frozenAt: startedAt }).where(eq(exams.id, examId));
    return {
      id: attempt.id, examId, status: attempt.status, deadlineAt: attempt.deadlineAt, startedAt,
      sessionId: attempt.activeSessionId, totalQuestions: paper.length, isSandbox: sandbox,
    };
  });
  if ("rejected" in result && result.rejected) {
    fail(403, result.rejected, result.rejected === "KEY_LOCKED" ? "The activation key is locked." : "The activation key is invalid.");
  }
  return result;
}
