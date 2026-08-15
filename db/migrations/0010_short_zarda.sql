CREATE TABLE "recent_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"reported_at" timestamp NOT NULL,
	"tournament_external_id" text NOT NULL,
	"edition_id" integer,
	"tournament_name" text NOT NULL,
	"competition" text NOT NULL,
	"round" text NOT NULL,
	"winner_id" integer NOT NULL,
	"loser_id" integer NOT NULL,
	"score_raw" text NOT NULL,
	"outcome" text NOT NULL,
	"reporter_id" integer,
	CONSTRAINT "recent_results_reported_at_winner_id_loser_id_round_unique" UNIQUE("reported_at","winner_id","loser_id","round")
);
--> statement-breakpoint
ALTER TABLE "recent_results" ADD CONSTRAINT "recent_results_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_results" ADD CONSTRAINT "recent_results_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_results" ADD CONSTRAINT "recent_results_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_results" ADD CONSTRAINT "recent_results_loser_id_players_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_results" ADD CONSTRAINT "recent_results_reporter_id_players_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;