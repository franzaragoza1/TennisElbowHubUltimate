CREATE INDEX "finals_matches_edition_idx" ON "finals_matches" USING btree ("finals_edition_id");--> statement-breakpoint
CREATE INDEX "finals_sets_match_idx" ON "finals_sets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_videos_match_idx" ON "match_videos" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "recent_result_sets_result_idx" ON "recent_result_sets" USING btree ("result_id");