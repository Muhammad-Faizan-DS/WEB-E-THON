import { z } from "zod";
import { ExamPhase } from "./exam";

/** GET /api/exams item (examiner) */
export const ExaminerExamRow = z.object({
  examId: z.uuid(),
  title: z.string(),
  code: z.string().optional(),
  phase: ExamPhase,
  opensAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  durationMin: z.number().int(),
  totalMarks: z.number(),
  questionCount: z.number().int(),
  enrolled: z.number().int(),
  inProgress: z.number().int(),
  submitted: z.number().int(),
  awaitingGrading: z.number().int(),
  pendingRequests: z.number().int(),
  priorityIncidents: z.number().int(),
});
export type ExaminerExamRow = z.infer<typeof ExaminerExamRow>;

export const ExaminerDashboard = z.object({
  serverNow: z.iso.datetime(),
  exams: z.array(ExaminerExamRow),
});
export type ExaminerDashboard = z.infer<typeof ExaminerDashboard>;
