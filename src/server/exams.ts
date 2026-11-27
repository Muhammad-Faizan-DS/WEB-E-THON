import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { activationKeys, attempts, enrollments, examQuestions, examSections, exams, questions, users } from "../../db/schema";
import { type ExamInput, type enrollmentInput } from "@/lib/contracts/core";
import { type z } from "zod";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { checkPaper, hashKey, newActivationKey, reattemptIssues, type PaperQuestion, type PaperSection } from "./paper";

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

/** Legacy `questionIds` writes replace the pool of a single-section exam. Multi-section exams use the section endpoints. */
async function setQuestions(tx: Tx, exam: Exam, ids: string[]) {
  const sections = await examSectionRows(tx, exam.id);
  if (sections.length > 1) fail(409, "USE_SECTIONS", "This exam has sections. Add or remove questions per section.");
  if (ids.length > 0) {
    const found = await tx.select({ id: questions.id }).from(questions)
      .where(and(inArray(questions.id, ids), eq(questions.ownerId, exam.examinerId), eq(questions.archived, false)))
      .orderBy(asc(questions.id)).for("share");
    if (found.length !== ids.length) fail(400, "INVALID_QUESTION_POOL", "Select active questions from your bank.");
  }
  await tx.delete(examQuestions).where(eq(examQuestions.examId, exam.id));
  if (ids.length === 0) return;
  const section = sections[0] ?? await ensureDefaultSection(tx, exam.id);
  await tx.insert(examQuestions).values(ids.map((questionId, index) => ({ examId: exam.id, questionId, sectionId: section.id, position: index + 1 })));
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
      id: enrollments.id, candidateId: enrollments.candidateId, name: users.name, email: users.email,
      timeMultiplier: enrollments.timeMultiplier, allowPaste: enrollments.allowPaste, status: enrollments.status,
    }).from(enrollments).innerJoin(users, eq(users.id, enrollments.candidateId)).where(eq(enrollments.examId, examId));
    return { ...exam, questionIds: linked.map(({ id }) => id), sections, editable: !exam.frozenAt, enrollments: candidates };
  });
}

export function createExam(examinerId: string, { questionIds, startsAt, endsAt, ...input }: ExamInput) {
  return database().transaction(async (tx) => {
    const [exam] = await tx.insert(exams).values({ ...input, examinerId, startsAt: new Date(startsAt), endsAt: new Date(endsAt) }).returning();
    await ensureDefaultSection(tx, exam.id);
    await setQuestions(tx, exam, questionIds);
    return { ...exam, questionIds };
  });
}

export function updateExam(examinerId: string, examId: string, input: Partial<ExamInput>) {
  return database().transaction(async (tx) => {
    const current = await ownedExam(tx, examinerId, examId);
    const { questionIds, startsAt, endsAt, ...fields } = input;
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
    if (questionIds) await setQuestions(tx, exam, questionIds);
    if (exam.status === "published" && !current.frozenAt) {
      if (questionIds || fields.settings) {
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
  return { canPublish: issues.length === 0, issues, pool };
}

export function getChecklist(examinerId: string, examId: string) {
  return database().transaction(async (tx) => {
    const { canPublish, issues } = await checklist(tx, await ownedExam(tx, examinerId, examId));
    return { canPublish, issues };
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
    return updated;
  });
}

export function enrollCandidates(examinerId: string, examId: string, picks: z.infer<typeof enrollmentInput>["candidates"]) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    if (exam.status !== "published") fail(409, "EXAM_NOT_PUBLISHED", "Publish the exam before enrolling candidates.");
    const candidates = await tx.select({ id: users.id }).from(users)
      .where(and(inArray(users.id, picks.map((pick) => pick.candidateId)), eq(users.role, "candidate"), eq(users.active, true)));
    if (candidates.length !== picks.length) fail(400, "INVALID_CANDIDATE", "Select active candidate accounts.");
    const current = await tx.select({ candidateId: enrollments.candidateId }).from(attempts)
      .innerJoin(enrollments, eq(attempts.enrollmentId, enrollments.id)).where(eq(enrollments.examId, examId));
    const started = new Set(current.map(({ candidateId }) => candidateId));
    if (picks.some(({ candidateId }) => started.has(candidateId))) fail(409, "ATTEMPT_EXISTS", "A selected candidate has already started.");
    return tx.insert(enrollments).values(picks.map((pick) => ({ ...pick, examId }))).onConflictDoUpdate({
      target: [enrollments.examId, enrollments.candidateId],
      set: { timeMultiplier: sql`excluded.time_multiplier`, allowPaste: sql`excluded.allow_paste` },
    }).returning();
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
    await tx.update(activationKeys).set({ status: "revoked" }).where(and(inArray(activationKeys.enrollmentId, ids), eq(activationKeys.status, "active")));
    const keys = ids.map((enrollmentId) => ({ enrollmentId, key: newActivationKey() }));
    await tx.insert(activationKeys).values(keys.map(({ enrollmentId, key }) => ({ enrollmentId, hint: key.slice(-2), keyHash: hashKey(key) })));
    return keys;
  });
}
