import { and, asc, count, eq, max, ne } from "drizzle-orm";
import { examQuestions, examSections, questions } from "../../db/schema";
import type { QuestionInput } from "@/lib/contracts/core";
import type { SectionInput, SectionPatch } from "@/lib/contracts/sections";
import { audit } from "./admin";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { examSectionRows, ownedExam, revalidate, type Section } from "./exams";

/** Owner-only, and only before the first candidate starts (BR-20). */
async function editableExam(tx: Tx, examinerId: string, examId: string) {
  const exam = await ownedExam(tx, examinerId, examId);
  if (exam.frozenAt) fail(409, "EXAM_FROZEN", "Questions and sections are frozen after the first candidate starts.");
  return exam;
}

async function ownedSection(tx: Tx, examId: string, sectionId: string) {
  const [section] = await tx.select().from(examSections)
    .where(and(eq(examSections.id, sectionId), eq(examSections.examId, examId))).for("update");
  if (!section) fail(404, "SECTION_NOT_FOUND", "This section is not part of the exam.");
  return section;
}

function typeIssue(section: Pick<Section, "title" | "allowedTypes">, type: QuestionInput["type"]) {
  return section.allowedTypes.length > 0 && !section.allowedTypes.includes(type)
    ? `${section.title} accepts ${section.allowedTypes.join(", ")} questions only.` : null;
}

async function withQuestionIds(tx: Tx, examId: string) {
  const links = await tx.select({ sectionId: examQuestions.sectionId, questionId: examQuestions.questionId }).from(examQuestions)
    .where(eq(examQuestions.examId, examId)).orderBy(asc(examQuestions.position));
  return (await examSectionRows(tx, examId)).map((section) => ({
    ...section, questionIds: links.filter((link) => link.sectionId === section.id).map(({ questionId }) => questionId),
  }));
}

async function renumber(tx: Tx, examId: string, ids: string[]) {
  for (const [index, id] of ids.entries()) {
    await tx.update(examSections).set({ position: index + 1 }).where(and(eq(examSections.id, id), eq(examSections.examId, examId)));
  }
}

export function listSections(examinerId: string, examId: string) {
  return database().transaction(async (tx) => {
    await ownedExam(tx, examinerId, examId);
    return withQuestionIds(tx, examId);
  });
}

export function createSection(examinerId: string, examId: string, input: SectionInput) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const [{ last }] = await tx.select({ last: max(examSections.position) }).from(examSections).where(eq(examSections.examId, examId));
    const [section] = await tx.insert(examSections).values({ ...input, examId, position: (last ?? 0) + 1 }).returning();
    await revalidate(tx, exam);
    await audit(tx, examinerId, "section_created", "exam", examId, { after: { sectionId: section.id, title: section.title } });
    return section;
  });
}

export function updateSection(examinerId: string, examId: string, { id, ...patch }: SectionPatch) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const before = await ownedSection(tx, examId, id);
    const [section] = await tx.update(examSections).set(patch).where(eq(examSections.id, id)).returning();
    if (patch.allowedTypes) {
      const members = await tx.select({ type: questions.type }).from(examQuestions)
        .innerJoin(questions, eq(questions.id, examQuestions.questionId)).where(eq(examQuestions.sectionId, id));
      const issue = members.map(({ type }) => typeIssue(section, type)).find(Boolean);
      if (issue) fail(409, "SECTION_TYPE_CONFLICT", issue + " Remove other question types first.");
    }
    await revalidate(tx, exam);
    await audit(tx, examinerId, "section_updated", "exam", examId, { before, after: section });
    return section;
  });
}

export function deleteSection(examinerId: string, examId: string, sectionId: string) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const section = await ownedSection(tx, examId, sectionId);
    await tx.delete(examQuestions).where(eq(examQuestions.sectionId, sectionId));
    await tx.delete(examSections).where(eq(examSections.id, sectionId));
    await renumber(tx, examId, (await examSectionRows(tx, examId)).map(({ id }) => id));
    await revalidate(tx, exam);
    await audit(tx, examinerId, "section_deleted", "exam", examId, { before: { sectionId, title: section.title } });
    return { id: sectionId, deleted: true };
  });
}

export function reorderSections(examinerId: string, examId: string, sectionIds: string[]) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const current = await examSectionRows(tx, examId).for("update");
    const known = new Set(current.map(({ id }) => id));
    if (sectionIds.length !== current.length || sectionIds.some((id) => !known.has(id))) {
      fail(400, "INVALID_SECTION_ORDER", "List every section of this exam exactly once.");
    }
    await renumber(tx, examId, sectionIds);
    await revalidate(tx, exam);
    return withQuestionIds(tx, examId);
  });
}


type ImportRow = { row: number; source?: string };
type ImportReader = () => Promise<{
  valid: Array<ImportRow & { question: QuestionInput }>;
  errors: Array<ImportRow & { message: string }>;
  commit: boolean;
  course?: string;
  tags?: string[];
}>;

async function addQuestions(tx: Tx, examId: string, section: Section, ownerId: string, batch: QuestionInput[]) {
  const [existing] = await tx.select({ total: count() }).from(examQuestions).where(eq(examQuestions.examId, examId));
  if (existing.total + batch.length > 1_000) fail(400, "EXAM_QUESTION_LIMIT", "An exam can contain up to 1,000 eligible questions.");
  const [{ last }] = await tx.select({ last: max(examQuestions.position) }).from(examQuestions).where(eq(examQuestions.sectionId, section.id));
  const created = await tx.insert(questions).values(batch.map((question) => ({ ...question, ownerId }))).returning({ id: questions.id });
  await tx.insert(examQuestions).values(created.map(({ id }, index) => ({
    examId, sectionId: section.id, questionId: id, position: (last ?? 0) + index + 1,
  })));
  return created.map(({ id }) => id);
}

export function listSectionQuestions(examinerId: string, examId: string, sectionId: string) {
  return database().transaction(async (tx) => {
    const exam = await ownedExam(tx, examinerId, examId);
    await ownedSection(tx, examId, sectionId);
    const rows = await tx.select({ question: questions, snapshot: examQuestions.snapshot, position: examQuestions.position })
      .from(examQuestions).innerJoin(questions, eq(examQuestions.questionId, questions.id))
      .where(and(eq(examQuestions.examId, examId), eq(examQuestions.sectionId, sectionId), eq(questions.archived, false)))
      .orderBy(asc(examQuestions.position), asc(questions.id));
    return rows.map(({ question, snapshot, position }) => {
      const content = exam.status === "published" && snapshot ? snapshot : question;
      return { id: question.id, position, type: content.type, text: content.text, topic: content.topic, difficulty: content.difficulty,
        marks: content.marks, options: content.options, course: content.course ?? question.course, tags: content.tags ?? question.tags };
    });
  });
}

export function createSectionQuestion(examinerId: string, examId: string, sectionId: string, question: QuestionInput) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const section = await ownedSection(tx, examId, sectionId);
    const issue = typeIssue(section, question.type);
    if (issue) fail(400, "SECTION_TYPE_CONFLICT", issue);
    const [id] = await addQuestions(tx, examId, section, examinerId, [{ ...question, course: question.course ?? exam.course }]);
    await revalidate(tx, exam);
    return { id };
  });
}

export function updateSectionQuestion(examinerId: string, examId: string, sectionId: string, questionId: string, question: QuestionInput) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const section = await ownedSection(tx, examId, sectionId);
    const scope = and(eq(examQuestions.examId, examId), eq(examQuestions.sectionId, sectionId), eq(examQuestions.questionId, questionId));
    const [current] = await tx.select({ id: examQuestions.questionId }).from(examQuestions).where(scope);
    if (!current) fail(404, "QUESTION_NOT_IN_SECTION", "This question is unavailable in this section.");
    const issue = typeIssue(section, question.type);
    if (issue) fail(400, "SECTION_TYPE_CONFLICT", issue);
    const changes = { ...question, course: question.course ?? exam.course };
    const [shared] = await tx.select({ examId: examQuestions.examId }).from(examQuestions)
      .where(and(eq(examQuestions.questionId, questionId), ne(examQuestions.examId, examId))).limit(1);
    let id = questionId;
    if (shared) {
      const [copy] = await tx.insert(questions).values({ ...changes, ownerId: examinerId }).returning({ id: questions.id });
      id = copy.id;
      await tx.update(examQuestions).set({ questionId: id, snapshot: null }).where(scope);
    } else {
      await tx.update(questions).set(changes).where(eq(questions.id, questionId));
    }
    await revalidate(tx, exam);
    return { id };
  });
}

export function detachFromSection(examinerId: string, examId: string, sectionId: string, questionId: string) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    await ownedSection(tx, examId, sectionId);
    const removed = await tx.delete(examQuestions).where(and(eq(examQuestions.examId, examId),
      eq(examQuestions.sectionId, sectionId), eq(examQuestions.questionId, questionId))).returning({ questionId: examQuestions.questionId });
    if (!removed.length) fail(404, "QUESTION_NOT_IN_SECTION", "This question is unavailable in this section.");
    await revalidate(tx, exam);
    return { id: questionId, removed: true };
  });
}

export async function importIntoSection(examinerId: string, examId: string, sectionId: string, read: ImportReader) {
  const db = database();
  await db.transaction(async (tx) => {
    await editableExam(tx, examinerId, examId);
    await ownedSection(tx, examId, sectionId);
  });
  const { valid: parsed, errors, commit, course, tags } = await read();
  return db.transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const section = await ownedSection(tx, examId, sectionId);
    const valid = parsed.flatMap(({ question, ...row }) => {
      const issue = typeIssue(section, question.type);
      if (issue) { errors.push({ ...row, message: issue }); return []; }
      return [{ ...row, question: { ...question, course: course ?? question.course ?? exam.course, tags: tags ?? question.tags ?? [] } }];
    });
    errors.sort((a, b) => (a.source ?? "").localeCompare(b.source ?? "") || a.row - b.row);
    if (!commit || !valid.length) return { valid, errors, imported: 0, questionIds: [] as string[] };
    const questionIds = await addQuestions(tx, examId, section, examinerId, valid.map(({ question }) => question));
    await revalidate(tx, exam);
    await audit(tx, examinerId, "section_import", "exam", examId, { after: { sectionId, imported: questionIds.length } });
    return { valid, errors, imported: questionIds.length, questionIds };
  });
}

