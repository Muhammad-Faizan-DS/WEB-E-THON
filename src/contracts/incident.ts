import { z } from "zod";
import { IntegrityEventType } from "./attempt";

export const IncidentSeverity = z.enum(["info", "review", "priority"]);
export type IncidentSeverity = z.infer<typeof IncidentSeverity>;

export const IncidentCategory = z.enum(["away", "paste", "connectivity", "session", "camera"]);
export type IncidentCategory = z.infer<typeof IncidentCategory>;

/** A stored observation as the examiner sees it (server-derived types included). */
export const ObservationType = z.union([IntegrityEventType, z.enum(["session_opened", "session_superseded", "heartbeat_gap"])]);
export type ObservationType = z.infer<typeof ObservationType>;

export const Observation = z.object({
  id: z.string(),
  type: ObservationType,
  clientTime: z.iso.datetime(),
  serverTime: z.iso.datetime(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type Observation = z.infer<typeof Observation>;

export const IncidentReview = z.object({
  decision: z.enum(["dismissed", "follow_up"]),
  note: z.string(),
  reviewer: z.string(),
  reviewedAt: z.iso.datetime(),
});
export type IncidentReview = z.infer<typeof IncidentReview>;

/** PRD §11 IncidentDTO. Derived on read from observations (deterministic key). */
export const IncidentDTO = z.object({
  key: z.string(),
  attemptId: z.string(),
  category: IncidentCategory,
  severity: IncidentSeverity,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  durationSec: z.number().nullable(),
  questionPosition: z.number().int().optional(),
  explanation: z.string(),
  groupingReason: z.string(),
  observations: z.array(Observation),
  review: IncidentReview.nullable(),
});
export type IncidentDTO = z.infer<typeof IncidentDTO>;

export const ReviewRequest = z.object({
  decision: z.enum(["dismissed", "follow_up"]),
  note: z.string().trim().max(500).default(""),
});
export type ReviewRequest = z.infer<typeof ReviewRequest>;

/** GET /api/attempts/{id}/incidents */
export const AttemptTimeline = z.object({
  serverNow: z.iso.datetime(),
  attempt: z.object({
    attemptId: z.string(),
    examId: z.string(),
    examTitle: z.string(),
    candidateName: z.string(),
    studentId: z.string().nullable(),
    status: z.enum(["in_progress", "locked", "submitted", "expired", "voided"]),
    startedAt: z.iso.datetime(),
    deadline: z.iso.datetime(),
    finalizedAt: z.iso.datetime().nullable(),
    answered: z.number().int(),
    total: z.number().int(),
    lastContactAt: z.iso.datetime().nullable(),
  }),
  sessions: z.array(z.object({ openedAt: z.iso.datetime(), userAgent: z.string(), active: z.boolean() })),
  maxOpens: z.number().int(),
  incidents: z.array(IncidentDTO),
});
export type AttemptTimeline = z.infer<typeof AttemptTimeline>;
