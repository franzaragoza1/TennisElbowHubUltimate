ALTER TABLE "editions" ALTER COLUMN "surface" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "finals_editions" ADD COLUMN "mirrored_edition_id" integer;--> statement-breakpoint
ALTER TABLE "finals_matches" ADD COLUMN "mirrored_match_id" integer;--> statement-breakpoint
ALTER TABLE "finals_editions" ADD CONSTRAINT "finals_editions_mirrored_edition_id_editions_id_fk" FOREIGN KEY ("mirrored_edition_id") REFERENCES "public"."editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finals_matches" ADD CONSTRAINT "finals_matches_mirrored_match_id_matches_id_fk" FOREIGN KEY ("mirrored_match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;