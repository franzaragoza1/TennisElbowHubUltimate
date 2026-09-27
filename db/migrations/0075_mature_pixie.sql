CREATE TABLE "discord_moderator_board" (
	"id" integer PRIMARY KEY NOT NULL,
	"message_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_matchup_threads" ADD COLUMN "last_activity_at" timestamp;--> statement-breakpoint
ALTER TABLE "discord_matchup_threads" ADD COLUMN "moderator_alerted_at" timestamp;