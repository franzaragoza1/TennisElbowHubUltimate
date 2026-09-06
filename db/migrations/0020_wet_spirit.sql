ALTER TABLE "match_stats" ADD COLUMN "first_serve_attempted" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "first_serve_points_played" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "first_serve_points_won" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "second_serve_points_played" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "second_serve_points_won" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "return_points_played" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "return_points_won" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "net_points_played" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "net_points_won" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "winners" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "forced_errors" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "unforced_errors" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "total_points_won" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "fastest_serve_kmh" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "avg_first_serve_speed_kmh" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD COLUMN "avg_second_serve_speed_kmh" integer;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_id_player_id_unique" UNIQUE("match_id","player_id");