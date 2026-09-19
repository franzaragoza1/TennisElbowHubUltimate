CREATE TABLE "news_comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_comment_likes_comment_id_user_id_unique" UNIQUE("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "news_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"news_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_likes_news_id_user_id_unique" UNIQUE("news_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "news_comments" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "news_comments" ADD COLUMN "root_id" integer;--> statement-breakpoint
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_comment_id_news_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."news_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_likes" ADD CONSTRAINT "news_likes_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_likes" ADD CONSTRAINT "news_likes_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_parent_id_news_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_root_id_news_comments_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."news_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_comments_root_id_idx" ON "news_comments" USING btree ("root_id");