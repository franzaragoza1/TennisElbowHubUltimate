DROP TABLE "award_votes" CASCADE;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD COLUMN "discord_poll_message_id" text;