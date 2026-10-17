CREATE TABLE "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"actor_name" text,
	"kind" text NOT NULL,
	"edition_id" integer,
	"summary" text NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_log_at_idx" ON "change_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "change_log_edition_idx" ON "change_log" USING btree ("edition_id");