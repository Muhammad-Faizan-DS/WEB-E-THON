/**
 * Exam authoring drafts (client-side until Dev A adds authoring to src/contracts). Used to validate the
 * New exam form before it is sent; the mock API in src/mocks/server.ts accepts the same shape.
 */
import { z } from "zod";

export const QuestionDraft = z
  .object({
    type: z.enum(["single", "multi", "written"]),
    topic: z.string().trim().max(60),
    prompt: z.string().trim().min(5, "write the question (at least 5 characters)").max(2000),
    marks: z.number().int().min(1, "give it at least 1 mark").max(100, "100 marks at most"),
    options: z.array(z.string().trim().min(1, "options can't be empty").max(300)),
    correct: z.array(z.number().int().min(0)),
    multiRule: z.enum(["exact", "partial"]),
  })
  .superRefine((q, ctx) => {
    if (q.type === "written") return;
    if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "add at least two options" });
    if (q.correct.length === 0) ctx.addIssue({ code: "custom", path: ["correct"], message: q.type === "single" ? "mark the correct option" : "mark at least one correct option" });
    if (q.type === "single" && q.correct.length > 1) ctx.addIssue({ code: "custom", path: ["correct"], message: "single choice has exactly one correct option" });
  });
export type QuestionDraft = z.infer<typeof QuestionDraft>;

export const ExamDraft = z
  .object({
    title: z.string().trim().min(3, "Give the exam a title (at least 3 characters).").max(120),
    code: z.string().trim().min(2, "Add a short code, for example STAT-201.").max(20).regex(/^[A-Za-z0-9-]+$/, "Codes use letters, numbers and dashes only."),
    durationMin: z.number().int().min(1, "The exam needs at least 1 minute.").max(300, "300 minutes at most."),
    opensInMin: z.number().int().min(0).max(10080),
    openForMin: z.number().int().min(5).max(20160),
    instructions: z.string().trim().max(3000),
    pastePolicy: z.enum(["block", "log", "allow"]),
    fullscreenRequired: z.boolean(),
    questions: z.array(QuestionDraft),
    enrolled: z.array(z.string()),
  })
  .refine((d) => d.openForMin >= d.durationMin, { path: ["openForMin"], message: "The window must be at least as long as the exam." });
export type ExamDraft = z.infer<typeof ExamDraft>;

/** Extra rules that apply only when publishing (a draft may be incomplete). */
export function publishProblems(d: ExamDraft): string[] {
  const out: string[] = [];
  if (d.questions.length === 0) out.push("Add at least one question before publishing.");
  if (d.enrolled.length === 0) out.push("Enrol at least one candidate before publishing.");
  return out;
}

export const CandidateList = z.object({
  candidates: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), studentId: z.string().nullable() })),
});
export const CreatedExam = z.object({ examId: z.string(), status: z.enum(["draft", "published"]) });
