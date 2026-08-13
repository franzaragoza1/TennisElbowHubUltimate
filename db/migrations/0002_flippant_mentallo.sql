CREATE TABLE "h2h_narratives" (
	"id" serial PRIMARY KEY NOT NULL,
	"low_player_id" integer NOT NULL,
	"high_player_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"narrative" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "h2h_narratives_low_player_id_high_player_id_unique" UNIQUE("low_player_id","high_player_id")
);
--> statement-breakpoint
ALTER TABLE "h2h_narratives" ADD CONSTRAINT "h2h_narratives_low_player_id_players_id_fk" FOREIGN KEY ("low_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "h2h_narratives" ADD CONSTRAINT "h2h_narratives_high_player_id_players_id_fk" FOREIGN KEY ("high_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;