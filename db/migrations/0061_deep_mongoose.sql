CREATE TABLE "tournament_registration_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"player_id" integer,
	"external_id" text NOT NULL,
	"display_name" text NOT NULL,
	"rank" integer,
	"location" text,
	"posts" integer,
	"sort_index" integer NOT NULL,
	CONSTRAINT "tournament_registration_queue_edition_id_external_id_unique" UNIQUE("edition_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "tournament_registration_queue" ADD CONSTRAINT "tournament_registration_queue_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registration_queue" ADD CONSTRAINT "tournament_registration_queue_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_registration_queue_edition_idx" ON "tournament_registration_queue" USING btree ("edition_id");