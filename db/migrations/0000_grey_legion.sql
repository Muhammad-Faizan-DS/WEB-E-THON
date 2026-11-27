CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'auto_submitted', 'voided', 'graded');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'pending_review', 'cooldown', 'rejected', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."key_status" AS ENUM('active', 'used', 'revoked', 'locked');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single', 'multi', 'written');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'examiner', 'candidate');--> statement-breakpoint
CREATE TABLE "activation_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"hint" text NOT NULL,
	"status" "key_status" DEFAULT 'active' NOT NULL,
	"failed_tries" integer DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"response" jsonb,
	"seq" integer DEFAULT 0 NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_attempt_id_question_id_pk" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "attempt_questions" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" "question_type" NOT NULL,
	"text" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer_key" jsonb NOT NULL,
	"marks" integer NOT NULL,
	"seen_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	CONSTRAINT "attempt_questions_attempt_id_question_id_pk" PRIMARY KEY("attempt_id","question_id"),
	CONSTRAINT "attempt_questions_attempt_id_position_unique" UNIQUE("attempt_id","position")
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid,
	"exam_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"is_sandbox" boolean DEFAULT false NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"active_session_id" uuid NOT NULL,
	"current_index" integer DEFAULT 1 NOT NULL,
	"time_credit_sec" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"settings" jsonb NOT NULL,
	CONSTRAINT "attempts_enrollment_id_attempt_no_unique" UNIQUE("enrollment_id","attempt_no"),
	CONSTRAINT "attempt_sandbox_enrollment" CHECK ("attempts"."is_sandbox" = ("attempts"."enrollment_id" is null))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"strikes" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp with time zone,
	"time_multiplier" real DEFAULT 1 NOT NULL,
	"allow_paste" boolean DEFAULT false NOT NULL,
	"camera_exception" boolean DEFAULT false NOT NULL,
	"open_limit_override" integer,
	CONSTRAINT "enrollments_exam_id_candidate_id_unique" UNIQUE("exam_id","candidate_id"),
	CONSTRAINT "enrollment_multiplier_range" CHECK ("enrollments"."time_multiplier" between 1 and 2)
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"snapshot" jsonb,
	CONSTRAINT "exam_questions_exam_id_question_id_pk" PRIMARY KEY("exam_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"examiner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"results_published" boolean DEFAULT false NOT NULL,
	"settings" jsonb NOT NULL,
	"frozen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"difficulty" integer NOT NULL,
	"type" "question_type" NOT NULL,
	"text" text NOT NULL,
	"options" jsonb NOT NULL,
	"marks" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_marks_positive" CHECK ("questions"."marks" > 0),
	CONSTRAINT "question_difficulty_range" CHECK ("questions"."difficulty" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activation_keys" ADD CONSTRAINT "activation_keys_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_question_id_attempt_questions_attempt_id_question_id_fk" FOREIGN KEY ("attempt_id","question_id") REFERENCES "public"."attempt_questions"("attempt_id","question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_examiner_id_users_id_fk" FOREIGN KEY ("examiner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keys_enrollment_idx" ON "activation_keys" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "keys_one_active_idx" ON "activation_keys" USING btree ("enrollment_id") WHERE "activation_keys"."status" = 'active';--> statement-breakpoint
CREATE INDEX "attempt_questions_question_idx" ON "attempt_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "attempts_exam_idx" ON "attempts" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "attempts_candidate_idx" ON "attempts" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "attempts_deadline_idx" ON "attempts" USING btree ("deadline_at") WHERE "attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_active_idx" ON "attempts" USING btree ("enrollment_id") WHERE "attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "enrollments_candidate_idx" ON "enrollments" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "exam_questions_question_idx" ON "exam_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "exams_examiner_idx" ON "exams" USING btree ("examiner_id");--> statement-breakpoint
CREATE INDEX "questions_owner_idx" ON "questions" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));