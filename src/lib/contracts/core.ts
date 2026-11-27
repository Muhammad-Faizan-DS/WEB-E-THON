import { z } from "zod";

export const id = z.string().uuid();
export const role = z.enum(["admin", "examiner", "candidate"]);
export const idInput = z.object({ id });
export const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const topic = z.string().trim().min(1).max(100);
export const marks = z.number().int().min(1).max(1_000);
export const option = z.object({ id: z.string().min(1).max(64), text: z.string().trim().min(1).max(2_000) });
export const questionType = z.enum(["single", "multi", "written"]);
export const course = z.string().trim().max(100);
export const tag = z.string().trim().min(1).max(40);
export const tags = z.array(tag).max(20).refine((items) => new Set(items.map((item) => item.toLowerCase())).size === items.length, "Use each tag once.");
export const questionInput = z.object({
  type: questionType,
  text: z.string().trim().min(1).max(16_000),
  topic,
  difficulty,
  marks,
  options: z.array(option.extend({ isCorrect: z.boolean() })).max(20).default([]),
  course: course.optional(),
  tags: tags.optional(),
}).strict().superRefine(({ type, options }, ctx) => {
  const correct = options.filter((item) => item.isCorrect).length;
  const unique = new Set(options.map((item) => item.id)).size === options.length;
  if (!unique || (type === "written" ? options.length !== 0 :
    options.length < 2 || correct < 1 || (type === "single" && correct !== 1))) {
    ctx.addIssue({ code: "custom", path: ["options"], message: "Options and correct choices must match the question type." });
  }
});

export const questionUpdate = z.object({ id, question: questionInput }).strict();
export const blueprintCell = z.object({ topic, difficulty, count: z.number().int().min(1).max(200) }).strict();
export const settings = z.object({
  multiSelectRule: z.enum(["all_or_nothing", "partial", "partial_negative"]).default("all_or_nothing"),
  blueprint: z.array(blueprintCell).max(100).default([]),
  openLimit: z.number().int().positive().safe().nullable().default(5),
  sequentialReveal: z.boolean().default(true),
  integrityMode: z.enum(["standard", "review", "strict"]).default("review"),
  cameraCheck: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
}).strict().superRefine(({ blueprint }, ctx) => {
  const keys = new Set(blueprint.map((cell) => JSON.stringify([cell.topic, cell.difficulty])));
  if (keys.size !== blueprint.length || blueprint.reduce((sum, cell) => sum + cell.count, 0) > 200) {
    ctx.addIssue({ code: "custom", path: ["blueprint"], message: "Use unique topic/difficulty cells and at most 200 paper questions." });
  }
});

export const examType = z.enum(["practice", "quiz", "assignment", "midterm", "final"]);
export const examInput = z.object({
  title: z.string().trim().min(1).max(200),
  examType: examType.default("quiz"),
  course: course.default(""),
  instructions: z.string().trim().max(16_000).default(""),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  durationMin: z.number().int().positive().max(1_440),
  totalMarks: z.number().int().positive().max(200_000),
  settings,
  questionIds: z.array(id).max(1_000).refine((ids) => new Set(ids).size === ids.length, "Use each question once.").default([]),
}).strict();
export const examPatch = examInput.partial().extend({ id }).strict();

export const enrollmentInput = z.object({
  candidates: z.array(z.object({
    candidateId: id,
    timeMultiplier: z.number().min(1).max(2).default(1),
    allowPaste: z.boolean().default(false),
  }).strict()).min(1).max(100).refine((items) => new Set(items.map((item) => item.candidateId)).size === items.length, "Use each candidate once."),
}).strict();
export const keysInput = z.object({
  enrollmentIds: z.array(id).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Use each enrollment once."),
}).strict();

export const empty = z.object({}).strict();
const deviceCheck = z.boolean();
const cameraReady = z.boolean().optional();
const session = z.object({ sessionId: id }).strict();
export const startInput = z.union([
  z.object({ sandbox: z.literal(false).default(false), key: z.string().trim().min(1).max(128), deviceCheck, cameraReady }).strict(),
  z.object({ sandbox: z.literal(true), deviceCheck }).strict(),
]);
export const heartbeatInput = z.union([session, z.object({ takeover: z.literal(true), deviceCheck }).strict()]);
export const mutateAttempt = session;
export const flagInput = session.extend({ flagged: z.boolean() });
export const response = z.union([z.string().max(24_000), z.array(z.string().min(1).max(64)).max(20), z.null()]);
export const saveInput = session.extend({
  answers: z.array(z.object({ qid: id, response, seq: z.number().int().min(1).max(2_147_483_647) }).strict()).min(1).max(200)
    .refine((answers) => new Set(answers.map((answer) => answer.qid)).size === answers.length, "Use each question once."),
});
export const questionPosition = z.coerce.number().int().min(1).max(200);

export type Role = z.infer<typeof role>;
export type ExamType = z.infer<typeof examType>;
export type BlueprintCell = z.infer<typeof blueprintCell>;
export type QuestionInput = z.infer<typeof questionInput>;
export type ExamSettings = z.infer<typeof settings>;
export type ExamInput = z.infer<typeof examInput>;
export type AnswerResponse = z.infer<typeof response>;

export type ApiResponse<T> =
  | { data: T; serverNow?: string }
  | { error: { code: string; message: string; fieldErrors?: Record<string, string[] | undefined> }; serverNow?: string };

export interface CandidateQuestion {
  id: string;
  position: number;
  sectionId: string | null;
  type: QuestionInput["type"];
  text: string;
  marks: number;
  options: Array<z.infer<typeof option>>;
  response: AnswerResponse;
  seq: number;
  locked: boolean;
  flagged: boolean;
}

export interface AttemptState {
  id: string;
  examId: string;
  status: "in_progress" | "submitted" | "auto_submitted" | "voided" | "graded";
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  sessionId?: string;
  isSandbox: boolean;
  openLimit: number | null;
  reviewUntil: string | null;
  integrityMode: ExamSettings["integrityMode"];
  incidentCount: number;
  announcements?: Array<{ id: string; message: string; createdAt: string }>;
  currentIndex: number;
  openCount: number;
  totalQuestions: number;
  palette: Array<{ position: number; sectionId: string | null; seen: boolean; locked: boolean; flagged: boolean; answered: boolean }>;
  /** Sections in paper order; group the palette by `sectionId` and show `instructions` when entering a section. */
  sections: Array<{ id: string; title: string; instructions: string; firstPosition: number; count: number }>;
}
