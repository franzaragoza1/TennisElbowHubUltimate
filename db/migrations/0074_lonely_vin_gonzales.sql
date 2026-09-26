ALTER TABLE "players" ADD COLUMN "availability" text;--> statement-breakpoint
-- Las fichas ya leídas (solo el país) se vuelven a leer una vez para recoger la disponibilidad.
UPDATE "players" SET "profile_checked_at" = NULL WHERE "profile_checked_at" IS NOT NULL;
