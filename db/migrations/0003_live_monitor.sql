CREATE TABLE "announcement_reads" (
	"announcement_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_announcement_id_candidate_id_pk" PRIMARY KEY("announcement_id","candidate_id")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "hand_raised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "hand_message" text;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_reads_candidate_idx" ON "announcement_reads" USING btree ("candidate_id");