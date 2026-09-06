CREATE TABLE "native_tournament_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"seed" integer,
	"status" text DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "native_tournament_registrations_edition_id_player_id_unique" UNIQUE("edition_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "native_tournament_registrations" ADD CONSTRAINT "native_tournament_registrations_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_tournament_registrations" ADD CONSTRAINT "native_tournament_registrations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;