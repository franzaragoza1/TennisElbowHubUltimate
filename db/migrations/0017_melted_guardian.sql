ALTER TABLE "players" ADD COLUMN "linked_user_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "start_year" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_linked_user_id_auth_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_linked_user_id_unique" UNIQUE("linked_user_id");