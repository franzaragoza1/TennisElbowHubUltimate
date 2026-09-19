CREATE INDEX "matches_player1_idx" ON "matches" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "matches_player2_idx" ON "matches" USING btree ("player2_id");