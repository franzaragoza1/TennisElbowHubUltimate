CREATE TABLE "player_name_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"unresolved_name" text NOT NULL,
	"suggested_player_id" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_name_suggestions_unresolved_name_unique" UNIQUE("unresolved_name")
);
--> statement-breakpoint
ALTER TABLE "match_log_files" ADD COLUMN "unresolved_names" jsonb;--> statement-breakpoint
ALTER TABLE "player_name_suggestions" ADD CONSTRAINT "player_name_suggestions_suggested_player_id_players_id_fk" FOREIGN KEY ("suggested_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;