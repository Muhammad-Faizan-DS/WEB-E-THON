import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import type { z } from "zod";
import { examQuestions, examSections, questions } from "../../db/schema";
import type { QuestionInput } from "@/lib/contracts/core";
import type { attachQuestions, sectionImport, SectionInput, SectionPatch } from "@/lib/contracts/sections";
import { audit } from "./admin";
import { database, type Tx } from "./database";
import { fail } from "./errors";
import { examSectionRows, ownedExam, revalidate, type Section } from "./exams";
import { previewQuestions } from "./imports";

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

async function link(tx: Tx, examId: string, section: Section, questionIds: string[], replace: boolean) {
  if (replace) await tx.delete(examQuestions).where(eq(examQuestions.sectionId, section.id));
  const [{ last }] = await tx.select({ last: max(examQuestions.position) }).from(examQuestions).where(eq(examQuestions.sectionId, section.id));
  await tx.insert(examQuestions).values(questionIds.map((questionId, index) => ({
    examId, questionId, sectionId: section.id, position: (last ?? 0) + index + 1,
  }))).onConflictDoUpdate({
    target: [examQuestions.examId, examQuestions.questionId],
    set: { sectionId: sql`excluded.section_id`, position: sql`excluded.position`, snapshot: null },
  });
}

export function attachToSection(examinerId: string, examId: string, sectionId: string, input: z.infer<typeof attachQuestions>) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const section = await ownedSection(tx, examId, sectionId);
    const found = await tx.select({ id: questions.id, type: questions.type }).from(questions)
      .where(and(inArray(questions.id, input.questionIds), eq(questions.ownerId, examinerId), eq(questions.archived, false)))
      .orderBy(asc(questions.id)).for("share");
    if (found.length !== input.questionIds.length) fail(400, "INVALID_QUESTION_POOL", "Select active questions from your bank.");
    const issue = found.map(({ type }) => typeIssue(section, type)).find(Boolean);
    if (issue) fail(400, "SECTION_TYPE_CONFLICT", issue);
    await link(tx, examId, section, input.questionIds, input.replace);
    await revalidate(tx, exam);
    return (await withQuestionIds(tx, examId)).find(({ id }) => id === sectionId)!;
  });
}

export function detachFromSection(examinerId: string, examId: string, sectionId: string, questionId: string) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    await ownedSection(tx, examId, sectionId);
    const removed = await tx.delete(examQuestions).where(and(eq(examQuestions.sectionId, sectionId), eq(examQuestions.questionId, questionId)))
      .returning({ questionId: examQuestions.questionId });
    if (!removed.length) fail(404, "QUESTION_NOT_IN_SECTION", "This question is not in the section.");
    await revalidate(tx, exam);
    return (await withQuestionIds(tx, examId)).find(({ id }) => id === sectionId)!;
  });
}

/**
 * Upload straight into a section (PRD §24.3): same preview/row-error flow as the bank import.
 * On commit, valid rows are saved to the bank tagged with the course and linked to the section, all in one transaction.
 */
export function importIntoSection(examinerId: string, examId: string, sectionId: string, input: z.infer<typeof sectionImport>) {
  return database().transaction(async (tx) => {
    const exam = await editableExam(tx, examinerId, examId);
    const section = await ownedSection(tx, examId, sectionId);
    const { valid: parsed, errors } = previewQuestions(input);
    const valid = parsed.flatMap((item) => {
      const issue = typeIssue(section, item.question.type);
      if (issue) { errors.push({ row: item.row, message: issue }); return []; }
      return [{ row: item.row, question: { ...item.question, course: input.course ?? item.question.course ?? exam.course,
        tags: input.tags ?? item.question.tags ?? [] } }];
    });
    errors.sort((a, b) => a.row - b.row);
    if (!input.commit || valid.length === 0) return { valid, errors, imported: 0, questionIds: [] as string[] };
    const created = await tx.insert(questions).values(valid.map(({ question }) => ({ ...question, ownerId: examinerId })))
      .returning({ id: questions.id });
    const questionIds = created.map(({ id }) => id);
    await link(tx, examId, section, questionIds, false);
    await revalidate(tx, exam);
    await audit(tx, examinerId, "section_import", "exam", examId, { after: { sectionId, imported: questionIds.length } });
    return { valid, errors, imported: questionIds.length, questionIds };
  });
}
