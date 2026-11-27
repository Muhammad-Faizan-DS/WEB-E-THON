import { z } from "zod";

export const QuestionType = z.enum(["single", "multi", "written"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const AttemptStatus = z.enum(["in_progress", "locked", "submitted", "expired", "voided"]);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

/** Never contains a key (BR-08). */
export const CandidateQuestion = z.object({
  aqId: z.uuid(),
  position: z.number().int(),
  type: QuestionType,
  topic: z.string().optional(),
  prompt: z.string(),
  marks: z.number(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  multiRule: z.enum(["exact", "partial"]).optional(),
});
export type CandidateQuestion = z.infer<typeof CandidateQuestion>;

export const AnswerValue = z.union([
  z.object({ optionIds: z.array(z.string()) }),
  z.object({ text: z.string().max(20000) }),
]);
export type AnswerValue = z.infer<typeof AnswerValue>;

export const SavedAnswer = z.object({
  aqId: z.uuid(),
  value: AnswerValue.nullable(),
  revision: z.number().int(),
  flagged: z.boolean(),
  savedAt: z.iso.datetime().nullable(),
});
export type SavedAnswer = z.infer<typeof SavedAnswer>;

export const AttemptPolicy = z.object({
  pastePolicy: z.enum(["allow", "block", "log"]),
  fullscreenRequired: z.boolean(),
  allowMobile: z.boolean(),
  maxOpens: z.number().int(),
  opensUsed: z.number().int(),
  cameraCheck: z.enum(["off", "presence"]),
});
export type AttemptPolicy = z.infer<typeof AttemptPolicy>;

export const Announcement = z.object({ id: z.uuid(), body: z.string(), createdAt: z.iso.datetime() });
export type Announcement = z.infer<typeof Announcement>;

export const PendingRequest = z
  .object({
    id: z.uuid(),
    type: z.enum(["unlock", "reattempt"]),
    status: z.enum(["pending", "approved", "denied"]),
    note: z.string().nullable().optional(),
  })
  .nullable();
export type PendingRequest = z.infer<typeof PendingRequest>;

export const StartAttemptRequest = z.object({ clientSessionId: z.string().min(8), sandbox: z.boolean().optional() });
export type StartAttemptRequest = z.infer<typeof StartAttemptRequest>;

export const SubmissionReceipt = z.object({
  attemptId: z.uuid(),
  examTitle: z.string(),
  receiptCode: z.string(),
  finalizedAt: z.iso.datetime(),
  reason: z.enum(["submit", "expiry", "examiner_close"]),
  acceptedCount: z.number().int(),
  unansweredCount: z.number().int(),
  questionCount: z.number().int(),
  resultsStatus: z.enum(["pending", "published"]),
  canRequestReattempt: z.boolean(),
});
export type SubmissionReceipt = z.infer<typeof SubmissionReceipt>;

/** Returned by POST /api/exams/{id}/attempts and GET /api/attempts/{id} */
export const AttemptState = z.object({
  attemptId: z.uuid(),
  examId: z.uuid(),
  examTitle: z.string(),
  isSandbox: z.boolean(),
  status: AttemptStatus,
  serverNow: z.iso.datetime(),
  deadline: z.iso.datetime(),
  durationMin: z.number().int(),
  totalMarks: z.number(),
  questions: z.array(CandidateQuestion),
  answers: z.array(SavedAnswer),
  policy: AttemptPolicy,
  announcements: z.array(Announcement),
  activeSession: z.boolean(),
  pendingRequest: PendingRequest.optional(),
  /** present once the attempt is finalized (submitted/expired) */
  receipt: SubmissionReceipt.nullable().optional(),
});
export type AttemptState = z.infer<typeof AttemptState>;

export const SaveAnswerRequest = z.object({
  value: AnswerValue.nullable(),
  revision: z.number().int().min(1),
  clientOpId: z.uuid(),
  clientSessionId: z.string().min(8),
});
export type SaveAnswerRequest = z.infer<typeof SaveAnswerRequest>;

export const SaveAnswerAck = z.object({ aqId: z.uuid(), revision: z.number().int(), savedAt: z.iso.datetime() });
export type SaveAnswerAck = z.infer<typeof SaveAnswerAck>;

export const FlagRequest = z.object({ flagged: z.boolean(), clientSessionId: z.string().min(8) });
export type FlagRequest = z.infer<typeof FlagRequest>;

export const HeartbeatRequest = z.object({ clientSessionId: z.string().min(8), answeredCount: z.number().int() });
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;

export const HeartbeatResponse = z.object({
  serverNow: z.iso.datetime(),
  deadline: z.iso.datetime(),
  status: AttemptStatus,
  activeSession: z.boolean(),
  announcements: z.array(Announcement),
  pendingRequest: PendingRequest,
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;

export const IntegrityEventType = z.enum([
  "visibility_hidden", "visibility_visible", "window_blur", "window_focus", "fullscreen_exit", "fullscreen_enter",
  "paste", "copy_blocked", "resize", "offline", "online", "mobile_detected", "face_absent_10s", "multiple_faces",
]);
export type IntegrityEventType = z.infer<typeof IntegrityEventType>;

export const IntegrityEventIn = z.object({
  clientEventId: z.uuid(),
  clientSeq: z.number().int().min(0),
  type: IntegrityEventType,
  clientTime: z.iso.datetime(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type IntegrityEventIn = z.infer<typeof IntegrityEventIn>;

export const EventsBatchRequest = z.object({ clientSessionId: z.string().min(8), events: z.array(IntegrityEventIn).max(200) });
export type EventsBatchRequest = z.infer<typeof EventsBatchRequest>;

export const SubmitRequest = z.object({ clientSessionId: z.string().min(8) });
export type SubmitRequest = z.infer<typeof SubmitRequest>;



export const RequestCreate = z.object({
  type: z.enum(["unlock", "reattempt"]),
  reasonCategory: z.enum(["connectivity", "device", "power", "other"]),
  reason: z.string().trim().min(10, "Please describe what happened (at least 10 characters)").max(500),
});
export type RequestCreate = z.infer<typeof RequestCreate>;
