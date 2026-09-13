CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "byes_edition_idx" ON "byes" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "matches_edition_idx" ON "matches" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "matches_round_idx" ON "matches" USING btree ("round");--> statement-breakpoint
CREATE INDEX "pending_slots_edition_idx" ON "pending_slots" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "ranking_snapshots_kind_rank_idx" ON "ranking_snapshots" USING btree ("kind","rank");