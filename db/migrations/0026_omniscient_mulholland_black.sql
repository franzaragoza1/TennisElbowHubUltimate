CREATE TABLE "discord_interview_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"player_id" integer NOT NULL,
	"opponent_id" integer NOT NULL,
	"score_raw" text,
	"thread_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"qa" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_interview_threads_edition_id_round_player_id_unique" UNIQUE("edition_id","round","player_id")
);
--> statement-breakpoint
CREATE TABLE "discord_match_result_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer NOT NULL,
	"message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_match_result_posts_edition_id_round_player1_id_player2_id_unique" UNIQUE("edition_id","round","player1_id","player2_id")
);
--> statement-breakpoint
CREATE TABLE "discord_matchup_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer NOT NULL,
	"thread_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"player1_confirmed_at" timestamp,
	"player2_confirmed_at" timestamp,
	"extension_days" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp,
	"overdue_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_matchup_threads_edition_id_round_player1_id_player2_id_unique" UNIQUE("edition_id","round","player1_id","player2_id")
);
--> statement-breakpoint
ALTER TABLE "discord_interview_threads" ADD CONSTRAINT "discord_interview_threads_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_interview_threads" ADD CONSTRAINT "discord_interview_threads_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_interview_threads" ADD CONSTRAINT "discord_interview_threads_opponent_id_players_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_match_result_posts" ADD CONSTRAINT "discord_match_result_posts_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_match_result_posts" ADD CONSTRAINT "discord_match_result_posts_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_match_result_posts" ADD CONSTRAINT "discord_match_result_posts_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_matchup_threads" ADD CONSTRAINT "discord_matchup_threads_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_matchup_threads" ADD CONSTRAINT "discord_matchup_threads_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_matchup_threads" ADD CONSTRAINT "discord_matchup_threads_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;