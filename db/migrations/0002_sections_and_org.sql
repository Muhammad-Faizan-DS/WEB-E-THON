CREATE TYPE "public"."exam_type" AS ENUM('practice', 'quiz', 'assignment', 'midterm', 'final');--> statement-breakpoint
CREATE TABLE "exam_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"allowed_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"shuffle" boolean DEFAULT true NOT NULL,
	"blueprint" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"marks_per_question" integer,
	CONSTRAINT "section_marks_positive" CHECK ("exam_sections"."marks_per_question" is null or "exam_sections"."marks_per_question" > 0)
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"name" text DEFAULT 'SecureExam' NOT NULL,
	"allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"allow_external_invites" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_settings_singleton" CHECK ("org_settings"."id")
);
--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "exam_type" "exam_type" DEFAULT 'quiz' NOT NULL;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "course" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "course" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_external" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_sections_exam_idx" ON "exam_sections" USING btree ("exam_id","position");--> statement-breakpoint
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_section_id_exam_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."exam_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_section_id_exam_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."exam_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_questions_section_idx" ON "attempt_questions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "exam_questions_section_idx" ON "exam_questions" USING btree ("section_id","position");--> statement-breakpoint
CREATE INDEX "questions_owner_course_idx" ON "questions" USING btree ("owner_id","course");--> statement-breakpoint
-- Backfill (PRD §24.3): every existing exam gets one default section that inherits the exam-level blueprint.
INSERT INTO "exam_sections" ("exam_id", "title", "position") SELECT "id", 'Section A', 1 FROM "exams";--> statement-breakpoint
WITH ordered AS (
	SELECT eq."exam_id", eq."question_id", s."id" AS section_id,
		row_number() OVER (PARTITION BY eq."exam_id" ORDER BY eq."question_id") AS pos
	FROM "exam_questions" eq JOIN "exam_sections" s ON s."exam_id" = eq."exam_id"
)
UPDATE "exam_questions" eq SET "section_id" = ordered.section_id, "position" = ordered.pos
FROM ordered WHERE eq."exam_id" = ordered."exam_id" AND eq."question_id" = ordered."question_id";--> statement-breakpoint
UPDATE "attempt_questions" aq SET "section_id" = s."id"
FROM "attempts" a JOIN "exam_sections" s ON s."exam_id" = a."exam_id" WHERE aq."attempt_id" = a."id";--> statement-breakpoint
ALTER TABLE "exam_questions" ALTER COLUMN "section_id" SET NOT NULL;--> statement-breakpoint
INSERT INTO "org_settings" ("id") VALUES (true) ON CONFLICT DO NOTHING;