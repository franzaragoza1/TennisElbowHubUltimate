CREATE TABLE "discussion_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"author_user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "finished_match_push_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finished_match_push_alerts_edition_id_round_player1_id_player2_id_unique" UNIQUE("edition_id","round","player1_id","player2_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "follows_user_id_target_type_target_id_unique" UNIQUE("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "live_match_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedup_key" text NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer NOT NULL,
	"edition_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "live_match_alerts_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text NOT NULL,
	"read_at" timestamp,
	"push_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "topic_comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_comment_likes_comment_id_user_id_unique" UNIQUE("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "topic_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"parent_id" integer,
	"root_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_likes_topic_id_user_id_unique" UNIQUE("topic_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "discussion_topics" ADD CONSTRAINT "discussion_topics_author_user_id_auth_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_match_push_alerts" ADD CONSTRAINT "finished_match_push_alerts_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_match_push_alerts" ADD CONSTRAINT "finished_match_push_alerts_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_match_push_alerts" ADD CONSTRAINT "finished_match_push_alerts_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comment_likes" ADD CONSTRAINT "topic_comment_likes_comment_id_topic_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."topic_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comment_likes" ADD CONSTRAINT "topic_comment_likes_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_topic_id_discussion_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."discussion_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_parent_id_topic_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topic_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_comments" ADD CONSTRAINT "topic_comments_root_id_topic_comments_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."topic_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_likes" ADD CONSTRAINT "topic_likes_topic_id_discussion_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."discussion_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_likes" ADD CONSTRAINT "topic_likes_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discussion_topics_last_activity_idx" ON "discussion_topics" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "follows_target_idx" ON "follows" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "follows_user_idx" ON "follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topic_comments_topic_id_idx" ON "topic_comments" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_comments_root_id_idx" ON "topic_comments" USING btree ("root_id");