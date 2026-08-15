CREATE TABLE "byes" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"player_id" integer NOT NULL,
	"sort_index" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "sort_index" integer;--> statement-breakpoint
ALTER TABLE "byes" ADD CONSTRAINT "byes_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byes" ADD CONSTRAINT "byes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;