CREATE TABLE "edition_round_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "edition_round_points_edition_id_round_unique" UNIQUE("edition_id","round")
);
--> statement-breakpoint
ALTER TABLE "edition_round_points" ADD CONSTRAINT "edition_round_points_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;