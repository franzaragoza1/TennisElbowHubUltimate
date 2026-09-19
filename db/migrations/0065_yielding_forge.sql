CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "discussion_topics_title_trgm_idx" ON "discussion_topics" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "events_display_name_trgm_idx" ON "events" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "match_videos_title_trgm_idx" ON "match_videos" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "news_title_trgm_idx" ON "news" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "players_display_name_trgm_idx" ON "players" USING gin ("display_name" gin_trgm_ops);