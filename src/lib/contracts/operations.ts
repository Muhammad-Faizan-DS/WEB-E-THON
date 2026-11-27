import { z } from "zod";
import { id, mutateAttempt, role } from "./core";

const reason = z.string().trim().min(3).max(2_000);
const password = z.string().min(12).refine((value) => new TextEncoder().encode(value).length <= 72, "Use at most 72 UTF-8 bytes.");
const flag = z.preprocess((value) => typeof value === "string" ? ["true", "yes", "1"].includes(value.trim().toLowerCase()) : value, z.boolean());
export const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const account = z.object({
  name: z.string().trim().min(1).max(150),
  email,
  password,
  role,
  /** Explicit invite for an address outside the institution's allowed domains (PRD §24.2). CSV accepts true/yes/1. */
  external: flag.default(false),
}).strict();
export const accountPatch = z.object({ id, active: z.boolean().optional(), role: role.optional(), name: account.shape.name.optional(),
  reason: z.string().trim().max(2_000).optional() })
  .strict().refine(({ active, role, name }) => active !== undefined || role !== undefined || name !== undefined, "Choose a change.");
const domain = z.string().trim().toLowerCase().min(3).max(253).regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Use a domain such as umt.edu.pk.");
export const orgSettingsInput = z.object({
  name: z.string().trim().min(1).max(150),
  allowedDomains: z.array(domain).max(20).refine((items) => new Set(items).size === items.length, "Use each domain once."),
  allowExternalInvites: z.boolean(),
}).strict();
export const accountImport = z.object({ csv: z.string().min(1).max(350_000), commit: z.boolean().default(false) }).strict();
export const questionImport = z.object({
  format: z.enum(["csv", "json", "moodle-xml", "gift"]),
  content: z.string().min(1).max(600_000),
  commit: z.boolean().default(false),
}).strict();
export const workspacePrefs = z.object({
  fontSize: z.enum(["normal", "large", "extra-large"]).default("normal"),
  theme: z.enum(["system", "light", "dark"]).default("system"),
  layout: z.enum(["single", "split", "list"]).default("split"),
}).strict();
export type WorkspacePreferences = z.infer<typeof workspacePrefs>;

export const integrityType = z.enum(["fullscreen_exit", "visibility_hidden", "window_blur", "return", "paste_blocked",
  "copy_blocked", "cut_blocked", "contextmenu_blocked", "drop_blocked", "page_hidden", "camera_no_face",
  "camera_multiple_faces", "camera_out_of_frame"]);
export const eventInput = mutateAttempt.extend({
  type: integrityType,
  qid: id.optional(),
  chars: z.number().int().min(0).max(24_000).optional(),
  frames: z.array(z.string().max(70_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)).length(3).optional(),
}).strict();
export const explanationInput = mutateAttempt.extend({ explanation: z.string().trim().min(10).max(2_000) }).strict();
export const announcementInput = z.object({ message: z.string().trim().min(1).max(2_000), candidateId: id.optional() }).strict();
export const timeCreditInput = z.object({ seconds: z.number().int().positive() }).strict();
export const liveLimitInput = z.object({ openLimit: z.number().int().min(1).max(2_147_483_647).nullable(), all: z.boolean().default(false) }).strict();
export const cameraExceptionInput = z.object({ enrollmentId: id, enabled: z.boolean(), reason }).strict();
export const incidentReview = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cleared"), note: reason }).strict(),
  z.object({ status: z.literal("confirmed"), note: reason, outcome: z.enum(["warning_only", "zero_question", "escalate_void"]), qid: id.optional() }).strict(),
]);
export const requestPatch = z.discriminatedUnion("action", [
  z.object({ id, action: z.literal("forward"), note: reason }).strict(),
  z.object({ id, action: z.enum(["approve", "reject"]), reason }).strict(),
]);
export const unblockInput = z.object({ reason }).strict();
const award = z.number().finite().min(0).max(1_000).multipleOf(0.01);
export const gradeInput = z.object({ marks: award, feedback: z.string().trim().max(2_000).default("") }).strict();
export const regradeInput = gradeInput.extend({ attemptId: id, qid: id, reason }).strict();
export const verifyCode = z.string().regex(/^[0-9a-f]{40}$/);
