CREATE TABLE "recent_result_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"winner_games" integer NOT NULL,
	"loser_games" integer NOT NULL,
	"tiebreak_loser_points" integer
);
--> statement-breakpoint
ALTER TABLE "recent_result_sets" ADD CONSTRAINT "recent_result_sets_result_id_recent_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."recent_results"("id") ON DELETE cascade ON UPDATE no action;