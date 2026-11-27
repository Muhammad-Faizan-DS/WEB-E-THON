import { z } from "zod";

export const ExamPhase = z.enum(["draft", "scheduled", "ongoing", "completed", "results_published"]);
export type ExamPhase = z.infer<typeof ExamPhase>;

export const PastePolicy = z.enum(["allow", "block", "log"]);

export const ExamSettings = z.object({
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  pastePolicy: PastePolicy,
  fullscreenRequired: z.boolean(),
  allowMobile: z.boolean(),
  maxOpens: z.number().int().min(1).max(10),
  maxReattempts: z.number().int().min(0).max(3),
  showBreakdown: z.boolean(),
  cameraCheck: z.enum(["off", "presence"]),
});
export type ExamSettings = z.infer<typeof ExamSettings>;

/** Candidate's view of their own status for an exam (drives the home card + entry page). */
export const CandidateExamStatus = z.enum([
  "not_started", "in_progress", "locked", "submitted", "expired", "results_published", "reattempt_granted", "missed",
]);
export type CandidateExamStatus = z.infer<typeof CandidateExamStatus>;

/** GET /api/me/exams item */
export const CandidateExamCard = z.object({
  examId: z.uuid(),
  title: z.string(),
  code: z.string().optional(),
  examinerName: z.string(),
  phase: ExamPhase,
  opensAt: z.iso.datetime(),
  closesAt: z.iso.datetime(),
  durationMin: z.number().int(),
  totalMarks: z.number(),
  questionCount: z.number().int(),
  status: CandidateExamStatus,
  attemptId: z.uuid().nullable(),
  /** server deadline for an in-progress attempt */
  deadline: z.iso.datetime().nullable(),
  /** only when status = results_published */
  scorePct: z.number().nullable(),
});
export type CandidateExamCard = z.infer<typeof CandidateExamCard>;

export const CandidateExamList = z.object({
  serverNow: z.iso.datetime(),
  available: z.array(CandidateExamCard),
  upcoming: z.array(CandidateExamCard),
  completed: z.array(CandidateExamCard),
});
export type CandidateExamList = z.infer<typeof CandidateExamList>;

/** GET /api/me/exams/{examId}: entry page */
export const CandidateExamEntry = CandidateExamCard.extend({
  instructions: z.string(),
  settings: ExamSettings,
  multiSelectRule: z.enum(["exact", "partial", "mixed"]),
  typeCounts: z.object({ single: z.number(), multi: z.number(), written: z.number() }),
  opensUsed: z.number().int(),
  serverNow: z.iso.datetime(),
});
export type CandidateExamEntry = z.infer<typeof CandidateExamEntry>;
