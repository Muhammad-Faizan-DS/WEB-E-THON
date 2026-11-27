import { hash } from "bcryptjs";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { activationKeys, attempts, enrollments, examQuestions, examSections, exams, questions, users } from "../../db/schema";
import { type ExamInput, type enrollmentInput } from "@/lib/contracts/core";
import { type z } from "zod";
import { accountOrigin, readOrgSettings, temporaryPassword } from "./accounts";
import { audit, knownEmails } from "./admin";
import { activeAdminIds, notify } from "./notifications";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { randomUUID } from "node:crypto";
import { activationKeyFor, checkPaper, displayKey, hashKey, reattemptIssues, type PaperQuestion, type PaperSection } from "./paper";
import { reattemptKey } from "./requests";

type Exam = typeof exams.$inferSelect;
export type Section = typeof examSections.$inferSelect;

export async function ownedExam(tx: Tx, examinerId: string, examId: string) {
  const [exam] = await tx.select().from(exams)
    .where(and(eq(exams.id, examId), eq(exams.examinerId, examinerId))).for("update");
  if (!exam) fail(403, "FORBIDDEN", "This exam is unavailable.");
  return exam;
}

export async function examPool(tx: Tx, exam: Exam): Promise<PaperQuestion[]> {
  const rows = await tx.select({ question: questions, snapshot: examQuestions.snapshot, sectionId: examQuestions.sectionId, position: examQuestions.position })
    .from(examQuestions).innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, exam.id)).orderBy(asc(questions.id)).for("share", { of: questions });
  return rows.flatMap(({ question, snapshot, sectionId, position }) => {
    if (exam.status === "published") return snapshot ? [{ id: question.id, ...snapshot, sectionId, position }] : [];
    if (question.archived) return [];
    const { id, topic, difficulty, type, text, options, marks } = question;
    return [{ id, topic, difficulty, type, text, options, marks, sectionId, position }];
  });
}

export function examSectionRows(tx: Tx, examId: string) {
  return tx.select().from(examSections).where(eq(examSections.examId, examId)).orderBy(asc(examSections.position), asc(examSections.id));
}

/**
 * Sections as the paper engine uses them. A section without its own blueprint uses every question it holds,
 * except a lone section, which inherits the exam-level blueprint (keeps pre-§24 exams and clients working).
 */
export async function paperSections(tx: Tx, exam: Exam): Promise<PaperSection[]> {
  const rows = await examSectionRows(tx, exam.id);
  return rows.map((section) => ({
    id: section.id, title: section.title, shuffle: section.shuffle, marksPerQuestion: section.marksPerQuestion,
    blueprint: section.blueprint.length ? section.blueprint
      : rows.length === 1 && exam.settings.blueprint.length ? exam.settings.blueprint : null,
  }));
}

export async function ensureDefaultSection(tx: Tx, examId: string) {
  const [first] = await examSectionRows(tx, examId).limit(1);
  if (first) return first;
  const [created] = await tx.insert(examSections).values({ examId, title: "Section A", position: 1 }).returning();
  return created;
}

export function listExams(examinerId?: string) {
  return database().select().from(exams).where(examinerId ? eq(exams.examinerId, examinerId) : undefined).orderBy(asc(exams.startsAt));
}

export function getExam(examinerId: string, examId: string) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    const linked = await tx.select({ id: examQuestions.questionId, sectionId: examQuestions.sectionId, position: examQuestions.position })
      .from(examQuestions).where(eq(examQuestions.examId, examId)).orderBy(asc(examQuestions.position));
    const sections = (await examSectionRows(tx, examId)).map((section) => ({
      ...section, questionIds: linked.filter((link) => link.sectionId === section.id).map(({ id }) => id),
    }));
    const candidates = await tx.select({
      id: enrollments.id, candidateId: enrollments.candidateId, name: users.name, email: users.email, isExternal: users.isExternal,
      timeMultiplier: enrollments.timeMultiplier, allowPaste: enrollments.allowPaste, status: enrollments.status,
    }).from(enrollments).innerJoin(users, eq(users.id, enrollments.candidateId)).where(eq(enrollments.examId, examId));
    return { ...exam, questionIds: linked.map(({ id }) => id), sections, editable: !exam.frozenAt, enrollments: candidates };
  });
}

export function createExam(examinerId: string, { startsAt, endsAt, ...input }: ExamInput) {
  return database().transaction(async (tx) => {
    const [exam] = await tx.insert(exams).values({ ...input, examinerId, startsAt: new Date(startsAt), endsAt: new Date(endsAt) }).returning();
    await ensureDefaultSection(tx, exam.id);
    return exam;
  });
}

export function updateExam(examinerId: string, examId: string, input: Partial<ExamInput>) {
  return database().transaction(async (tx) => {
    const current = await ownedExam(tx, examinerId, examId);
    const { startsAt, endsAt, ...fields } = input;
    if (current.frozenAt) {
      if (!endsAt || new Date(endsAt) <= current.endsAt || Object.keys(input).length !== 1) {
        fail(409, "EXAM_FROZEN", "Only the exam window can be extended after a candidate starts.");
      }
    }
    const patch = { ...fields, ...(startsAt ? { startsAt: new Date(startsAt) } : {}), ...(endsAt ? { endsAt: new Date(endsAt) } : {}) };
    let exam = current;
    if (Object.keys(patch).length > 0) {
      [exam] = await tx.update(exams).set(patch).where(eq(exams.id, examId)).returning();
    }
    if (exam.status === "published" && !current.frozenAt) {
      if (fields.settings) {
        await validateAndSnapshot(tx, { ...exam, status: "draft" });
      } else {
        const { issues } = await checklist(tx, exam);
        if (issues.length) fail(409, "PUBLISH_CHECKLIST_FAILED", issues.join(" "));
      }
    }
    if (exam.endsAt > current.endsAt && current.frozenAt) {
      await tx.update(attempts).set({
        deadlineAt: sql`least(${exam.endsAt.toISOString()}::timestamptz, ${attempts.startedAt} + make_interval(secs => (${exam.durationMin} * 60 * e.time_multiplier + ${attempts.timeCreditSec})))`,
      }).from(sql`${enrollments} e`).where(and(eq(attempts.examId, examId), eq(attempts.status, "in_progress"),
        sql`${attempts.enrollmentId} = e.id and ${attempts.deadlineAt} > clock_timestamp()`));
    }
    const links = await tx.select({ questionId: examQuestions.questionId }).from(examQuestions).where(eq(examQuestions.examId, examId));
    return { ...exam, questionIds: links.map(({ questionId }) => questionId) };
  });
}

async function checklist(tx: Tx, exam: Exam) {
  const pool = await examPool(tx, exam);
  const sections = await paperSections(tx, exam);
  const issues = checkPaper(pool, sections, exam.totalMarks);
  if (exam.settings.integrityMode === "strict") issues.push(...reattemptIssues(pool, sections));
  if (exam.endsAt <= exam.startsAt) issues.push("The exam must end after it starts.");
  if (exam.durationMin < 1) issues.push("Duration must be positive.");
  // Explains the paper so "total marks" is never a surprise: a blueprint draws a subset of a larger pool.
  const summary = sections.map((section) => {
    const items = section.id === null ? pool : pool.filter((question) => question.sectionId === section.id);
    const marksOf = (question: PaperQuestion) => section.marksPerQuestion ?? question.marks;
    const drawn = section.blueprint
      ? section.blueprint.map((cell) => ({ count: cell.count, marks: items.find((q) => q.topic === cell.topic && q.difficulty === cell.difficulty) }))
      : items.map((question) => ({ count: 1, marks: question }));
    return {
      sectionId: section.id, title: section.title, poolQuestions: items.length,
      paperQuestions: drawn.reduce((sum, cell) => sum + cell.count, 0),
      paperMarks: drawn.reduce((sum, cell) => sum + cell.count * (cell.marks ? marksOf(cell.marks) : 0), 0),
      drawsSubset: Boolean(section.blueprint) && drawn.reduce((sum, cell) => sum + cell.count, 0) < items.length,
    };
  });
  return { canPublish: issues.length === 0, issues, pool, summary,
    paper: { questions: summary.reduce((sum, item) => sum + item.paperQuestions, 0), marks: summary.reduce((sum, item) => sum + item.paperMarks, 0),
      totalMarks: exam.totalMarks } };
}

export function getChecklist(examinerId: string, examId: string) {
  return database().transaction(async (tx) => {
    const { canPublish, issues, summary, paper } = await checklist(tx, await ownedExam(tx, examinerId, examId));
    return { canPublish, issues, sections: summary, paper };
  });
}

async function validateAndSnapshot(tx: Tx, exam: Exam) {
  const { canPublish, issues, pool } = await checklist(tx, exam);
  if (!canPublish) fail(409, "PUBLISH_CHECKLIST_FAILED", issues.join(" "));
  await tx.update(examQuestions).set({ snapshot: null }).where(eq(examQuestions.examId, exam.id));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const { id, sectionId, position, ...snapshot } of pool) {
    await tx.update(examQuestions).set({ snapshot })
      .where(and(eq(examQuestions.examId, exam.id), eq(examQuestions.questionId, id)));
  }
}

/** After a content change: a published, not-yet-started exam must still pass the checklist and gets a fresh snapshot. */
export async function revalidate(tx: Tx, exam: Exam) {
  if (exam.frozenAt) fail(409, "EXAM_FROZEN", "Questions and sections are frozen after the first candidate starts.");
  if (exam.status === "published") await validateAndSnapshot(tx, { ...exam, status: "draft" });
}

export function publishExam(examinerId: string, examId: string, publish: boolean) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    if (publish && exam.status === "draft") {
      await validateAndSnapshot(tx, exam);
    } else if (!publish && exam.frozenAt) {
      fail(409, "EXAM_FROZEN", "An exam with candidate attempts cannot be unpublished.");
    }
    const [updated] = await tx.update(exams).set({ status: publish ? "published" : "draft" }).where(eq(exams.id, examId)).returning();
    if (exam.status !== updated.status) await audit(tx, examinerId, publish ? "exam_published" : "exam_unpublished", "exam", examId);
    return updated;
  });
}

/**
 * Enrols candidates by id or by email (PRD §24.2). An unknown email creates a candidate account (external only when
 * explicitly invited) and returns its one-time temporary password in the response; nothing is emailed.
 */
export async function enrollCandidates(examinerId: string, examId: string, picks: z.infer<typeof enrollmentInput>["candidates"], actorId = examinerId) {
  const settings = await readOrgSettings();
  const emails = picks.flatMap((pick) => "email" in pick ? [pick.email] : []);
  const known = await knownEmails(emails);
  const prepared = new Map(await Promise.all(emails.filter((email) => !known.has(email)).map(async (email) => {
    const password = temporaryPassword();
    return [email, { password, passwordHash: await hash(password, 10) }] as const;
  })));
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    if (exam.status !== "published") fail(409, "EXAM_NOT_PUBLISHED", "Publish the exam before enrolling candidates.");
    const created = new Map<string, string>();
    const resolved = [];
    for (const pick of picks) {
      if (!("email" in pick)) { resolved.push(pick); continue; }
      const { email, name, external, ...rest } = pick;
      let [user] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
      if (!user) {
        const fresh = prepared.get(email);
        if (!fresh) fail(409, "ACCOUNT_CHANGED", "An account was created for this email meanwhile. Try again.");
        const { isExternal } = accountOrigin(email, external, settings);
        [user] = await tx.insert(users).values({ email, name: name ?? email.split("@")[0], role: "candidate", isExternal,
          passwordHash: fresh.passwordHash }).returning({ id: users.id });
        await audit(tx, actorId, isExternal ? "external_user_invited" : "candidate_account_created", "user", user.id,
          { after: { role: "candidate", isExternal, examId } });
        created.set(user.id, fresh.password);
      }
      resolved.push({ candidateId: user.id, ...rest });
    }
    if (new Set(resolved.map(({ candidateId }) => candidateId)).size !== resolved.length) fail(400, "DUPLICATE_CANDIDATE", "Use each candidate once.");
    const candidates = await tx.select({ id: users.id, email: users.email, isExternal: users.isExternal }).from(users)
      .where(and(inArray(users.id, resolved.map((pick) => pick.candidateId)), eq(users.role, "candidate"), eq(users.active, true)));
    if (candidates.length !== resolved.length) fail(400, "INVALID_CANDIDATE", "Select active candidate accounts.");
    const current = await tx.select({ candidateId: enrollments.candidateId }).from(attempts)
      .innerJoin(enrollments, eq(attempts.enrollmentId, enrollments.id)).where(eq(enrollments.examId, examId));
    const started = new Set(current.map(({ candidateId }) => candidateId));
    if (resolved.some(({ candidateId }) => started.has(candidateId))) fail(409, "ATTEMPT_EXISTS", "A selected candidate has already started.");
    const rows = await tx.insert(enrollments).values(resolved.map((pick) => ({ ...pick, examId }))).onConflictDoUpdate({
      target: [enrollments.examId, enrollments.candidateId],
      set: { timeMultiplier: sql`excluded.time_multiplier`, allowPaste: sql`excluded.allow_paste` },
    }).returning();
    // Every enrolled candidate gets their own key automatically; it also seeds their paper (paperSeed).
    const keyed = await tx.select({ enrollmentId: activationKeys.enrollmentId }).from(activationKeys)
      .where(and(inArray(activationKeys.enrollmentId, rows.map(({ id }) => id)), eq(activationKeys.status, "active")));
    const needKey = rows.filter((row) => row.status === "active" && !row.cooldownUntil && !keyed.some((item) => item.enrollmentId === row.id))
      .map(({ id }) => id);
    const issued = new Map((await createKeys(tx, needKey)).map(({ enrollmentId, key }) => [enrollmentId, key]));
    await audit(tx, actorId, "candidates_enrolled", "exam", examId, { after: { enrollments: rows.length, keysIssued: issued.size } });
    await notify(tx, rows.map(({ candidateId }) => candidateId), { kind: "enrolment", title: `You are enrolled in ${exam.title}`,
      body: `Opens ${exam.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`, link: "/portal/candidate" });
    return rows.map((row) => {
      const person = candidates.find(({ id }) => id === row.candidateId)!;
      return { ...row, email: person.email, isExternal: person.isExternal, temporaryPassword: created.get(row.candidateId) ?? null,
        key: issued.get(row.id) ?? null };
    });
  });
}

/** Revokes any active key and issues a fresh per-candidate key. Returns display keys. */
async function createKeys(tx: Tx, enrollmentIds: string[]) {
  if (!enrollmentIds.length) return [];
  await tx.update(activationKeys).set({ status: "revoked" })
    .where(and(inArray(activationKeys.enrollmentId, enrollmentIds), eq(activationKeys.status, "active")));
  const keys = enrollmentIds.map((enrollmentId) => {
    const id = randomUUID();
    return { id, enrollmentId, key: activationKeyFor(id) };
  });
  await tx.insert(activationKeys).values(keys.map(({ id, enrollmentId, key }) => ({ id, enrollmentId, hint: key.slice(-2), keyHash: hashKey(key) })));
  return keys.map(({ enrollmentId, key }) => ({ enrollmentId, key: displayKey(key) }));
}

/** Examiner view of every candidate's key: re-displayable because keys are derived from the row id and AUTH_SECRET. */
export function listKeys(examinerId: string, examId: string) {
  return database().transaction(async (tx) => {
    await ownedExam(tx, examinerId, examId);
    const rows = await tx.select({
      enrollmentId: enrollments.id, candidateId: users.id, name: users.name, email: users.email, isExternal: users.isExternal,
      enrollmentStatus: enrollments.status, keyId: activationKeys.id, keyHash: activationKeys.keyHash, status: activationKeys.status,
      hint: activationKeys.hint, failedTries: activationKeys.failedTries, issuedAt: activationKeys.issuedAt, usedAt: activationKeys.usedAt,
    }).from(enrollments).innerJoin(users, eq(users.id, enrollments.candidateId))
      .leftJoin(activationKeys, eq(activationKeys.enrollmentId, enrollments.id))
      .where(eq(enrollments.examId, examId)).orderBy(asc(users.name), sql`${activationKeys.issuedAt} desc nulls last`);
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.enrollmentId)) latest.set(row.enrollmentId, row);
    return [...latest.values()].map(({ keyId, keyHash, ...row }) => {
      const plain = keyId && row.status === "active" ? [activationKeyFor(keyId), reattemptKey(keyId)].find((key) => hashKey(key) === keyHash) : undefined;
      return { ...row, status: row.status ?? "none", key: plain ? displayKey(plain) : null };
    });
  });
}

export function issueKeys(examinerId: string, examId: string, ids: string[]) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    if (exam.status !== "published") fail(409, "EXAM_NOT_PUBLISHED", "Publish the exam before issuing keys.");
    const eligible = await tx.select({ id: enrollments.id }).from(enrollments)
      .innerJoin(users, eq(enrollments.candidateId, users.id))
      .where(and(eq(enrollments.examId, examId), inArray(enrollments.id, ids), eq(enrollments.status, "active"),
        isNull(enrollments.cooldownUntil), eq(users.active, true)));
    if (eligible.length !== ids.length) fail(400, "INVALID_ENROLLMENT", "Select active enrollments for this exam.");
    const [started] = await tx.select({ id: attempts.id }).from(attempts).where(inArray(attempts.enrollmentId, ids)).limit(1);
    if (started) fail(409, "ATTEMPT_EXISTS", "A selected enrollment already has an attempt.");
    const keys = await createKeys(tx, ids);
    await audit(tx, examinerId, "keys_regenerated", "exam", examId, { after: { count: keys.length } });
    return keys;
  });
}

/** The exam's owning examiner id, for administrator actions that run on the examiner's behalf. */
export async function examOwner(examId: string) {
  const [row] = await database().select({ examinerId: exams.examinerId }).from(exams).where(eq(exams.id, examId));
  if (!row) fail(404, "EXAM_NOT_FOUND", "Exam not found.");
  return row.examinerId;
}

/**
 * Removes a candidate from an exam with a recorded reason (examiner of the exam, or an administrator).
 * Not allowed once the candidate has an attempt: evidence and answers are kept, so use integrity review instead.
 */
export function removeEnrollment(actor: { id: string; role: string }, examId: string, enrollmentId: string, reason: string) {
  return database().transaction(async (tx) => {
    const [exam] = await tx.select().from(exams).where(eq(exams.id, examId)).for("update");
    if (!exam || (actor.role === "examiner" && exam.examinerId !== actor.id)) fail(403, "FORBIDDEN", "This exam is unavailable.");
    const [row] = await tx.select({ id: enrollments.id, candidateId: enrollments.candidateId, name: users.name }).from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.candidateId)).where(and(eq(enrollments.id, enrollmentId), eq(enrollments.examId, examId))).for("update", { of: enrollments });
    if (!row) fail(404, "ENROLLMENT_NOT_FOUND", "This candidate is not enrolled in the exam.");
    const [started] = await tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.enrollmentId, enrollmentId)).limit(1);
    if (started) fail(409, "ATTEMPT_EXISTS", "This candidate has already started. Keep the record and use integrity review instead.");
    await tx.delete(activationKeys).where(eq(activationKeys.enrollmentId, enrollmentId));
    await tx.delete(enrollments).where(eq(enrollments.id, enrollmentId));
    await audit(tx, actor.id, "candidate_removed", "exam", examId, { reason, before: { enrollmentId, candidateId: row.candidateId, name: row.name } });
    await notify(tx, [row.candidateId], { kind: "enrolment", title: `You were removed from ${exam.title}`, body: reason, link: "/portal/candidate" });
    if (actor.role === "examiner") await notify(tx, await activeAdminIds(tx), { kind: "enrolment",
      title: `Examiner removed ${row.name} from ${exam.title}`, body: reason, link: "/portal/admin/audit" });
    return { removed: enrollmentId };
  });
}
