CREATE TABLE "finals_editions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finals_editions_kind_year_unique" UNIQUE("kind","year")
);
--> statement-breakpoint
CREATE TABLE "finals_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"finals_edition_id" integer NOT NULL,
	"stage" text NOT NULL,
	"group" text,
	"slot" text,
	"player1_id" integer,
	"player2_id" integer,
	"winner_id" integer,
	"outcome" text DEFAULT 'scheduled' NOT NULL,
	"score_raw" text,
	"played_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "finals_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"finals_edition_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"seed" integer NOT NULL,
	"group" text,
	"status" text DEFAULT 'active' NOT NULL,
	"replaces_participant_id" integer,
	CONSTRAINT "finals_participants_finals_edition_id_player_id_unique" UNIQUE("finals_edition_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "finals_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"winner_games" integer NOT NULL,
	"loser_games" integer NOT NULL,
	"tiebreak_loser_points" integer
);
--> statement-breakpoint
ALTER TABLE "finals_matches" ADD CONSTRAINT "finals_matches_finals_edition_id_finals_editions_id_fk" FOREIGN KEY ("finals_edition_id") REFERENCES "public"."finals_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_matches" ADD CONSTRAINT "finals_matches_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_matches" ADD CONSTRAINT "finals_matches_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_matches" ADD CONSTRAINT "finals_matches_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_participants" ADD CONSTRAINT "finals_participants_finals_edition_id_finals_editions_id_fk" FOREIGN KEY ("finals_edition_id") REFERENCES "public"."finals_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_participants" ADD CONSTRAINT "finals_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_sets" ADD CONSTRAINT "finals_sets_match_id_finals_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."finals_matches"("id") ON DELETE cascade ON UPDATE no action;