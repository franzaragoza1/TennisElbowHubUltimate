CREATE TABLE "discord_live_board" (
	"id" integer PRIMARY KEY NOT NULL,
	"message_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_waiting_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"elo" integer NOT NULL,
	"rep" integer NOT NULL,
	"sets" integer NOT NULL,
	"preview" text NOT NULL,
	"difficulty" text NOT NULL,
	"mode" text NOT NULL,
	"comment" text NOT NULL,
	"announced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discord_waiting_players_display_name_unique" UNIQUE("display_name")
);
