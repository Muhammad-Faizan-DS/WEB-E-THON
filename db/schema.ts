import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { WorkspacePreferences } from "../src/lib/contracts/operations";
import type { AnswerResponse, BlueprintCell, ExamSettings, QuestionInput } from "../src/lib/contracts/core";

const time = (name: string) => timestamp(name, { withTimezone: true });
export const userRole = pgEnum("user_role", ["admin", "examiner", "candidate"]);
export const questionType = pgEnum("question_type", ["single", "multi", "written"]);
export const examStatus = pgEnum("exam_status", ["draft", "published"]);
export const enrollmentStatus = pgEnum("enrollment_status", ["active", "pending_review", "cooldown", "rejected", "blocked"]);
export const keyStatus = pgEnum("key_status", ["active", "used", "revoked", "locked"]);
export const examType = pgEnum("exam_type", ["practice", "quiz", "assignment", "midterm", "final"]);
export const attemptStatus = pgEnum("attempt_status", ["in_progress", "submitted", "auto_submitted", "voided", "graded"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  isExternal: boolean("is_external").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)]);

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  topic: text("topic").notNull(),
  difficulty: integer("difficulty").$type<QuestionInput["difficulty"]>().notNull(),
  type: questionType("type").notNull(),
  text: text("text").notNull(),
  options: jsonb("options").$type<QuestionInput["options"]>().notNull(),
  marks: integer("marks").notNull(),
  course: text("course").notNull().default(""),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  archived: boolean("archived").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(),
}, (t) => [index("questions_owner_idx").on(t.ownerId), index("questions_owner_course_idx").on(t.ownerId, t.course), check("question_marks_positive", sql`${t.marks} > 0`),
  check("question_difficulty_range", sql`${t.difficulty} between 1 and 3`)]);

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  examinerId: uuid("examiner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  examType: examType("exam_type").notNull().default("quiz"),
  course: text("course").notNull().default(""),
  instructions: text("instructions").notNull(),
  startsAt: time("starts_at").notNull(),
  endsAt: time("ends_at").notNull(),
  durationMin: integer("duration_min").notNull(),
  totalMarks: integer("total_marks").notNull(),
  status: examStatus("status").notNull().default("draft"),
  resultsPublished: boolean("results_published").notNull().default(false),
  settings: jsonb("settings").$type<ExamSettings>().notNull(),
  frozenAt: time("frozen_at"),
  liveOpenLimit: integer("live_open_limit"),
}, (t) => [index("exams_examiner_idx").on(t.examinerId)]);

export const examSections = pgTable("exam_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id").notNull().references(() => exams.id),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  position: integer("position").notNull(),
  allowedTypes: text("allowed_types").array().$type<QuestionInput["type"][]>().notNull().default(sql`'{}'::text[]`),
  shuffle: boolean("shuffle").notNull().default(true),
  blueprint: jsonb("blueprint").$type<BlueprintCell[]>().notNull().default([]),
  marksPerQuestion: integer("marks_per_question"),
}, (t) => [index("exam_sections_exam_idx").on(t.examId, t.position),
  check("section_marks_positive", sql`${t.marksPerQuestion} is null or ${t.marksPerQuestion} > 0`)]);

export const examQuestions = pgTable("exam_questions", {
  examId: uuid("exam_id").notNull().references(() => exams.id),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  sectionId: uuid("section_id").notNull().references(() => examSections.id),
  position: integer("position").notNull().default(0),
  snapshot: jsonb("snapshot").$type<QuestionInput>(),
}, (t) => [primaryKey({ columns: [t.examId, t.questionId] }), index("exam_questions_question_idx").on(t.questionId),
  index("exam_questions_section_idx").on(t.sectionId, t.position)]);

export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id").notNull().references(() => exams.id),
  candidateId: uuid("candidate_id").notNull().references(() => users.id),
  status: enrollmentStatus("status").notNull().default("active"),
  strikes: integer("strikes").notNull().default(0),
  cooldownUntil: time("cooldown_until"),
  timeMultiplier: real("time_multiplier").notNull().default(1),
  allowPaste: boolean("allow_paste").notNull().default(false),
  cameraException: boolean("camera_exception").notNull().default(false),
  openLimitOverride: integer("open_limit_override"),
}, (t) => [unique().on(t.examId, t.candidateId), index("enrollments_candidate_idx").on(t.candidateId),
  check("enrollment_multiplier_range", sql`${t.timeMultiplier} between 1 and 2`)]);

export const activationKeys = pgTable("activation_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
  keyHash: text("key_hash").notNull(),
  hint: text("hint").notNull(),
  status: keyStatus("status").notNull().default("active"),
  failedTries: integer("failed_tries").notNull().default(0),
  issuedAt: time("issued_at").notNull().defaultNow(),
  usedAt: time("used_at"),
}, (t) => [index("keys_enrollment_idx").on(t.enrollmentId),
  uniqueIndex("keys_one_active_idx").on(t.enrollmentId).where(sql`${t.status} = 'active'`)]);

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id),
  examId: uuid("exam_id").notNull().references(() => exams.id),
  candidateId: uuid("candidate_id").notNull().references(() => users.id),
  attemptNo: integer("attempt_no").notNull().default(1),
  isSandbox: boolean("is_sandbox").notNull().default(false),
  status: attemptStatus("status").notNull().default("in_progress"),
  startedAt: time("started_at").notNull(),
  deadlineAt: time("deadline_at").notNull(),
  submittedAt: time("submitted_at"),
  activeSessionId: uuid("active_session_id").notNull(),
  currentIndex: integer("current_index").notNull().default(1),
  timeCreditSec: integer("time_credit_sec").notNull().default(0),
  lastHeartbeatAt: time("last_heartbeat_at"),
  pendingIntegrityAt: time("pending_integrity_at"),
  integrityIncidentId: uuid("integrity_incident_id"),
  reviewUntil: time("review_until"),
  /** "Ask examiner" (raised hand): set by the candidate, cleared when they lower it or the examiner replies privately. */
  handRaisedAt: time("hand_raised_at"),
  handMessage: text("hand_message"),
  scoreCents: integer("score_cents"),
  settings: jsonb("settings").$type<ExamSettings>().notNull(),
}, (t) => [index("attempts_exam_idx").on(t.examId), index("attempts_candidate_idx").on(t.candidateId),
  index("attempts_deadline_idx").on(t.deadlineAt).where(sql`${t.status} = 'in_progress'`),
  unique().on(t.enrollmentId, t.attemptNo),
  uniqueIndex("attempts_one_active_idx").on(t.enrollmentId).where(sql`${t.status} = 'in_progress'`),
  check("attempt_sandbox_enrollment", sql`${t.isSandbox} = (${t.enrollmentId} is null)`)]);

export const attemptQuestions = pgTable("attempt_questions", {
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  sectionId: uuid("section_id").references(() => examSections.id),
  position: integer("position").notNull(),
  type: questionType("type").notNull(),
  text: text("text").notNull(),
  options: jsonb("options").$type<Array<{ id: string; text: string }>>().notNull(),
  answerKey: jsonb("answer_key").$type<string[]>().notNull(),
  marks: integer("marks").notNull(),
  seenAt: time("seen_at"),
  lockedAt: time("locked_at"),
}, (t) => [primaryKey({ columns: [t.attemptId, t.questionId] }),
  unique().on(t.attemptId, t.position), index("attempt_questions_question_idx").on(t.questionId),
  index("attempt_questions_section_idx").on(t.sectionId)]);

export const answers = pgTable("answers", {
  attemptId: uuid("attempt_id").notNull(),
  questionId: uuid("question_id").notNull(),
  response: jsonb("response").$type<AnswerResponse>(),
  seq: integer("seq").notNull().default(0),
  flagged: boolean("flagged").notNull().default(false),
  savedAt: time("saved_at").notNull().defaultNow(),
  awardedCents: integer("awarded_cents"),
  zeroed: boolean("zeroed").notNull().default(false),
  feedback: text("feedback"),
  graderId: uuid("grader_id").references(() => users.id),
  editTimeline: jsonb("edit_timeline").$type<Array<{ at: string; chars: number }>>().notNull().default([]),
}, (t) => [primaryKey({ columns: [t.attemptId, t.questionId] }),
  foreignKey({ columns: [t.attemptId, t.questionId], foreignColumns: [attemptQuestions.attemptId, attemptQuestions.questionId] })]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  at: time("at").notNull().defaultNow(),
  reason: text("reason"),
  before: jsonb("before"),
  after: jsonb("after"),
}, (t) => [index("audit_actor_idx").on(t.actorId), index("audit_entity_idx").on(t.entityId, t.at)]);
export const preferences = pgTable("user_prefs", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  prefs: jsonb("prefs").$type<WorkspacePreferences>().notNull(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id),
  startedAt: time("started_at").notNull(),
  endedAt: time("ended_at").notNull(),
  priority: text("priority").$type<"low" | "review" | "priority">().notNull(),
  summary: text("summary").notNull(),
  reviewStatus: text("review_status").$type<"unreviewed" | "cleared" | "confirmed">().notNull().default("unreviewed"),
  outcome: text("outcome").$type<"warning_only" | "zero_question" | "escalate_void">(),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  note: text("note"),
}, (t) => [index("incidents_attempt_time_idx").on(t.attemptId, t.endedAt), index("incidents_reviewer_idx").on(t.reviewerId)]);

export const integrityEvents = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id),
  type: text("type").notNull(),
  questionId: uuid("question_id").references(() => questions.id),
  at: time("at").notNull(),
  incidentId: uuid("incident_id").references(() => incidents.id),
  meta: jsonb("meta").$type<{ detail?: string; chars?: number }>(),
}, (t) => [index("events_attempt_time_idx").on(t.attemptId, t.at), index("events_incident_idx").on(t.incidentId),
  index("events_question_idx").on(t.questionId)]);

export const snapshots = pgTable("snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => integrityEvents.id),
  seq: integer("seq").notNull(),
  image: text("image").notNull(),
}, (t) => [unique().on(t.eventId, t.seq)]);

export const gaps = pgTable("heartbeat_gaps", {
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id),
  startedAt: time("started_at").notNull(),
  endedAt: time("ended_at").notNull(),
}, (t) => [primaryKey({ columns: [t.attemptId, t.startedAt] })]);

export const reattemptRequests = pgTable("reattempt_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id).unique(),
  enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id),
  status: text("status").$type<"pending_examiner" | "pending_admin" | "approved" | "rejected">().notNull().default("pending_examiner"),
  examinerNote: text("examiner_note"),
  adminId: uuid("admin_id").references(() => users.id),
  adminReason: text("admin_reason"),
  createdAt: time("created_at").notNull().defaultNow(),
  decidedAt: time("decided_at"),
}, (t) => [index("requests_enrollment_idx").on(t.enrollmentId), index("requests_admin_idx").on(t.adminId)]);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id").notNull().references(() => exams.id),
  targetCandidateId: uuid("target_candidate_id").references(() => users.id),
  message: text("message").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, (t) => [index("announcements_exam_idx").on(t.examId, t.createdAt), index("announcements_candidate_idx").on(t.targetCandidateId)]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id).unique(),
  verifyCode: text("verify_code").notNull().unique(),
  hmac: text("hmac").notNull(),
  issuedAt: time("issued_at").notNull().defaultNow(),
});

export const gradeNotices = pgTable("grade_notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => attempts.id),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  createdAt: time("created_at").notNull().defaultNow(),
}, (t) => [index("grade_notices_attempt_idx").on(t.attemptId, t.createdAt), index("grade_notices_question_idx").on(t.questionId)]);


/** Single-institution settings (PRD §24.2). One row, enforced by the boolean key. */
export const orgSettings = pgTable("org_settings", {
  id: boolean("id").primaryKey().default(true),
  name: text("name").notNull().default("SecureExam"),
  allowedDomains: text("allowed_domains").array().notNull().default(sql`'{}'::text[]`),
  allowExternalInvites: boolean("allow_external_invites").notNull().default(true),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, (t) => [check("org_settings_singleton", sql`${t.id}`)]);

/** Read receipts: a candidate pressed "Got it" on an announcement. */
export const announcementReads = pgTable("announcement_reads", {
  announcementId: uuid("announcement_id").notNull().references(() => announcements.id),
  candidateId: uuid("candidate_id").notNull().references(() => users.id),
  readAt: time("read_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.announcementId, t.candidateId] }), index("announcement_reads_candidate_idx").on(t.candidateId)]);
