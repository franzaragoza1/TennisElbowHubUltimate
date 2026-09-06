CREATE TABLE "match_log_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"html" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"last_processed_at" timestamp DEFAULT now() NOT NULL,
	"total_online_entries" integer DEFAULT 0 NOT NULL,
	"linked" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"errors" jsonb
);
--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "match_log_file_id" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_log_file_id_match_log_files_id_fk" FOREIGN KEY ("match_log_file_id") REFERENCES "public"."match_log_files"("id") ON DELETE cascade ON UPDATE no action;