import { z } from "zod";
import { ExamPhase } from "./exam";
import { Announcement } from "./attempt";

export const ContactState = z.enum(["live", "stale", "lost", "none"]);
export type ContactState = z.infer<typeof ContactState>;

export const MonitorRow = z.object({
  enrollmentId: z.string(),
  candidateId: z.string(),
  candidateName: z.string(),
  studentId: z.string().nullable(),
  attemptId: z.string().nullable(),
  status: z.enum(["not_started", "in_progress", "locked", "submitted", "expired"]),
  answered: z.number().int(),
  total: z.number().int(),
  startedAt: z.iso.datetime().nullable(),
  deadline: z.iso.datetime().nullable(),
  finalizedAt: z.iso.datetime().nullable(),
  lastContactAt: z.iso.datetime().nullable(),
  /** server-derived from lastContactAt: live < 30 s, stale < 90 s, lost otherwise */
  contact: ContactState,
  opensUsed: z.number().int(),
  maxOpens: z.number().int(),
  incidents: z.object({ info: z.number().int(), review: z.number().int(), priority: z.number().int() }),
  unreviewed: z.number().int(),
  pendingRequest: z.object({ id: z.string(), type: z.enum(["unlock", "reattempt"]) }).nullable(),
});
export type MonitorRow = z.infer<typeof MonitorRow>;

/** GET /api/exams/{id}/monitor */
export const ExamMonitor = z.object({
  serverNow: z.iso.datetime(),
  exam: z.object({
    examId: z.string(),
    title: z.string(),
    code: z.string().optional(),
    phase: ExamPhase,
    opensAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    durationMin: z.number().int(),
    questionCount: z.number().int(),
  }),
  totals: z.object({
    enrolled: z.number().int(), notStarted: z.number().int(), inProgress: z.number().int(),
    locked: z.number().int(), submitted: z.number().int(), expired: z.number().int(),
  }),
  rows: z.array(MonitorRow),
  announcements: z.array(Announcement),
  pendingRequests: z.number().int(),
});
export type ExamMonitor = z.infer<typeof ExamMonitor>;

export const AnnouncementCreate = z.object({ body: z.string().trim().min(1, "Write a message").max(500, "Keep it under 500 characters") });
export type AnnouncementCreate = z.infer<typeof AnnouncementCreate>;

/** GET /api/exams/{id}/requests item */
export const ExamRequest = z.object({
  id: z.string(),
  attemptId: z.string(),
  candidateName: z.string(),
  type: z.enum(["unlock", "reattempt"]),
  reasonCategory: z.enum(["connectivity", "device", "power", "other"]),
  reason: z.string(),
  status: z.enum(["pending", "approved", "denied"]),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  decidedBy: z.string().nullable(),
  decisionNote: z.string().nullable(),
  /** context for the decision */
  attemptStatus: z.enum(["in_progress", "locked", "submitted", "expired", "voided"]),
  opensUsed: z.number().int(),
  connectivityIncidents: z.number().int(),
  offlineSeconds: z.number().int(),
});
export type ExamRequest = z.infer<typeof ExamRequest>;

export const ExamRequestList = z.object({ requests: z.array(ExamRequest) });
export type ExamRequestList = z.infer<typeof ExamRequestList>;

export const DecisionRequest = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().trim().min(3, "Add a short note for the record").max(500),
});
export type DecisionRequest = z.infer<typeof DecisionRequest>;
