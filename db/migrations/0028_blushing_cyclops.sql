CREATE TABLE "scrape_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"input" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"error" text,
	"result_edition_id" integer
);
--> statement-breakpoint
ALTER TABLE "scrape_requests" ADD CONSTRAINT "scrape_requests_result_edition_id_editions_id_fk" FOREIGN KEY ("result_edition_id") REFERENCES "public"."editions"("id") ON DELETE no action ON UPDATE no action;