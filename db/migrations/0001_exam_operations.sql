CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"target_candidate_id" uuid,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_gaps" (
	"attempt_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	CONSTRAINT "heartbeat_gaps_attempt_id_started_at_pk" PRIMARY KEY("attempt_id","started_at")
);
--> statement-breakpoint
CREATE TABLE "grade_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"priority" text NOT NULL,
	"summary" text NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"outcome" text,
	"reviewer_id" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"type" text NOT NULL,
	"question_id" uuid,
	"at" timestamp with time zone NOT NULL,
	"incident_id" uuid,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"prefs" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reattempt_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"status" text DEFAULT 'pending_examiner' NOT NULL,
	"examiner_note" text,
	"admin_id" uuid,
	"admin_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "reattempt_requests_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"verify_code" text NOT NULL,
	"hmac" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "reports_verify_code_unique" UNIQUE("verify_code")
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"image" text NOT NULL,
	CONSTRAINT "snapshots_event_id_seq_unique" UNIQUE("event_id","seq")
);
--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "awarded_cents" integer;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "zeroed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "feedback" text;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "grader_id" uuid;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "edit_timeline" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "pending_integrity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "integrity_incident_id" uuid;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "review_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "score_cents" integer;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "before" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "after" jsonb;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "live_open_limit" integer;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_candidate_id_users_id_fk" FOREIGN KEY ("target_candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_gaps" ADD CONSTRAINT "heartbeat_gaps_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_notices" ADD CONSTRAINT "grade_notices_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_notices" ADD CONSTRAINT "grade_notices_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reattempt_requests" ADD CONSTRAINT "reattempt_requests_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reattempt_requests" ADD CONSTRAINT "reattempt_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reattempt_requests" ADD CONSTRAINT "reattempt_requests_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_exam_idx" ON "announcements" USING btree ("exam_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_candidate_idx" ON "announcements" USING btree ("target_candidate_id");--> statement-breakpoint
CREATE INDEX "grade_notices_attempt_idx" ON "grade_notices" USING btree ("attempt_id","created_at");--> statement-breakpoint
CREATE INDEX "grade_notices_question_idx" ON "grade_notices" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "incidents_attempt_time_idx" ON "incidents" USING btree ("attempt_id","ended_at");--> statement-breakpoint
CREATE INDEX "incidents_reviewer_idx" ON "incidents" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "events_attempt_time_idx" ON "events" USING btree ("attempt_id","at");--> statement-breakpoint
CREATE INDEX "events_incident_idx" ON "events" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "events_question_idx" ON "events" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "requests_enrollment_idx" ON "reattempt_requests" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "requests_admin_idx" ON "reattempt_requests" USING btree ("admin_id");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_grader_id_users_id_fk" FOREIGN KEY ("grader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_id","at");