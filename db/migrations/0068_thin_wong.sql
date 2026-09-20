CREATE TABLE "discord_temporary_role_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_key" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_temporary_role_grants_role_key_discord_user_id_unique" UNIQUE("role_key","discord_user_id")
);
--> statement-breakpoint
CREATE INDEX "discord_temporary_role_grants_expires_idx" ON "discord_temporary_role_grants" USING btree ("expires_at");