CREATE TABLE "pending_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"round" text NOT NULL,
	"player1_id" integer,
	"player2_id" integer,
	"player1_seed" integer,
	"player2_seed" integer,
	"sort_index" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "byes" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "pending_slots" ADD CONSTRAINT "pending_slots_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_slots" ADD CONSTRAINT "pending_slots_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_slots" ADD CONSTRAINT "pending_slots_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;