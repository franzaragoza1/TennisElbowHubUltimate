CREATE TABLE "bracket_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"picks" jsonb NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bracket_predictions_edition_id_user_id_unique" UNIQUE("edition_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "bracket_predictions" ADD CONSTRAINT "bracket_predictions_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_predictions" ADD CONSTRAINT "bracket_predictions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;