CREATE TABLE "news_reporter_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"notified_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "auth_users" ADD COLUMN "is_reporter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "submitted_by_user_id" text;--> statement-breakpoint
ALTER TABLE "news_reporter_requests" ADD CONSTRAINT "news_reporter_requests_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_submitted_by_user_id_auth_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;