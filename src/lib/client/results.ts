/** Candidate result DTO (client-side until Dev A adds it to src/contracts); matches the mock API. */
import { z } from "zod";

export const MyResult = z.object({
  examId: z.string(),
  title: z.string(),
  code: z.string(),
  examinerName: z.string(),
  candidateName: z.string(),
  studentId: z.string().nullable(),
  publishedAt: z.string(),
  totalMarks: z.number(),
  questionCount: z.number(),
  scorePct: z.number().nullable(),
  marks: z.number().nullable(),
});
export type MyResult = z.infer<typeof MyResult>;
