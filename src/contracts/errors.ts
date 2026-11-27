import { z } from "zod";

export const ErrorCode = z.enum([
  "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION", "EXAM_NOT_OPEN", "EXAM_CLOSED",
  "NOT_ENROLLED", "ALREADY_SUBMITTED", "ATTEMPT_CLOSED", "ATTEMPT_LOCKED", "SESSION_SUPERSEDED",
  "STALE_REVISION", "REQUEST_NOT_ALLOWED", "PUBLISH_BLOCKED", "RATE_LIMITED",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** PRD §7 error shape, returned by every endpoint on failure. */
export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
