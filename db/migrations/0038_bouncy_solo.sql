ALTER TABLE "player_builds" DROP CONSTRAINT "player_builds_player_id_unique";--> statement-breakpoint
ALTER TABLE "player_builds" ADD COLUMN "name" text NOT NULL DEFAULT 'My Build';--> statement-breakpoint
ALTER TABLE "player_builds" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "player_builds" ADD COLUMN "in_use" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "player_builds" SET "in_use" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "player_builds_one_in_use" ON "player_builds" USING btree ("player_id") WHERE "player_builds"."in_use" = true;
