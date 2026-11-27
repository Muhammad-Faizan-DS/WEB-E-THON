import { and, asc, eq } from "drizzle-orm";
import { examQuestions, questions } from "../../db/schema";
import { type QuestionInput } from "@/lib/contracts/core";
import { database } from "./database";
import { fail } from "./errors";

export function listQuestions(ownerId?: string) {
  return database().select().from(questions).where(ownerId ? eq(questions.ownerId, ownerId) : undefined).orderBy(asc(questions.createdAt));
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
