CREATE TABLE "match_previews" (
	"id" serial PRIMARY KEY NOT NULL,
	"pending_slot_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"narrative" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_previews_pending_slot_id_unique" UNIQUE("pending_slot_id")
);
--> statement-breakpoint
ALTER TABLE "match_previews" ADD CONSTRAINT "match_previews_pending_slot_id_pending_slots_id_fk" FOREIGN KEY ("pending_slot_id") REFERENCES "public"."pending_slots"("id") ON DELETE cascade ON UPDATE no action;