CREATE TABLE "award_nominations" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"category_key" text NOT NULL,
	"player_id" integer,
	"match_id" integer,
	"clip_url" text,
	"clip_drive_file_id" text,
	"caption" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"submitted_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"speech" text,
	"voting_opens_at" timestamp,
	"voting_closes_at" timestamp,
	"announced_open_at" timestamp,
	"announced_closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"category_key" text NOT NULL,
	"nomination_id" integer NOT NULL,
	"voter_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "award_votes_period_id_category_key_voter_user_id_unique" UNIQUE("period_id","category_key","voter_user_id")
);
--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_period_id_award_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."award_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_submitted_by_user_id_auth_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_votes" ADD CONSTRAINT "award_votes_period_id_award_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."award_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_votes" ADD CONSTRAINT "award_votes_nomination_id_award_nominations_id_fk" FOREIGN KEY ("nomination_id") REFERENCES "public"."award_nominations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_votes" ADD CONSTRAINT "award_votes_voter_user_id_auth_users_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;