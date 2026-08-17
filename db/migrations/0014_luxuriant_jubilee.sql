ALTER TABLE "news" ADD COLUMN "auto_key" text;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_auto_key_unique" UNIQUE("auto_key");