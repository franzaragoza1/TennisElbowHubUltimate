CREATE TABLE "discord_role_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_key" text NOT NULL,
	"discord_user_id" text NOT NULL,
	CONSTRAINT "discord_role_members_role_key_discord_user_id_unique" UNIQUE("role_key","discord_user_id")
);
