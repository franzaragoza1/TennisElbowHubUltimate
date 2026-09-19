CREATE TABLE "live_role_holders" (
	"role_key" text PRIMARY KEY NOT NULL,
	"discord_user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
