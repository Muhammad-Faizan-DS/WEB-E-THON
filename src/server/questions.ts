import { and, arrayContains, asc, eq, inArray, sql } from "drizzle-orm";
import { examQuestions, exams, questions } from "../../db/schema";
import { type QuestionInput } from "@/lib/contracts/core";
import { database } from "./database";
import { fail } from "./errors";

/** Bank listing with optional course / tag filters and, per question, the exams that use it ("Used in"). */
export async function listQuestions(ownerId?: string, filters: { course?: string; tag?: string } = {}) {
  const db = database();
  const rows = await db.select().from(questions).where(and(
    ownerId ? eq(questions.ownerId, ownerId) : undefined,
    filters.course !== undefined ? sql`lower(${questions.course}) = lower(${filters.course})` : undefined,
    filters.tag ? arrayContains(questions.tags, [filters.tag]) : undefined,
  )).orderBy(asc(questions.createdAt));
  const links = rows.length ? await db.select({ questionId: examQuestions.questionId, examId: exams.id, title: exams.title })
    .from(examQuestions).innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(inArray(examQuestions.questionId, rows.map(({ id }) => id))) : [];
  return rows.map((question) => ({
    ...question, usedIn: links.filter((item) => item.questionId === question.id).map(({ examId, title }) => ({ examId, title })),
  }));
}

export async function createQuestion(ownerId: string, input: QuestionInput) {
  const [question] = await database().insert(questions).values({ ...input, ownerId }).returning();
  return question;
}

export async function updateQuestion(ownerId: string, questionId: string, input: QuestionInput) {
  const [question] = await database().update(questions).set(input)
    .where(and(eq(questions.id, questionId), eq(questions.ownerId, ownerId))).returning();
  if (!question) fail(403, "FORBIDDEN", "This question is unavailable.");
  return question;
}

export async function removeQuestion(ownerId: string, questionId: string) {
  return database().transaction(async (tx) => {
    const [question] = await tx.select({ id: questions.id }).from(questions)
      .where(and(eq(questions.id, questionId), eq(questions.ownerId, ownerId))).for("update");
    if (!question) fail(403, "FORBIDDEN", "This question is unavailable.");
    const [link] = await tx.select({ examId: examQuestions.examId }).from(examQuestions)
      .where(eq(examQuestions.questionId, questionId)).limit(1);
    if (link) {
      await tx.update(questions).set({ archived: true }).where(eq(questions.id, questionId));
      return { id: questionId, archived: true };
    }
    await tx.delete(questions).where(eq(questions.id, questionId));
    return { id: questionId, archived: false };
  });
}
