CREATE TABLE "player_overviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"overview" text NOT NULL,
	"tips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_overviews_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "real_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "playstyle" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "clothing_brand" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "racket_brand" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "instagram_handle" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "player_overviews" ADD CONSTRAINT "player_overviews_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;