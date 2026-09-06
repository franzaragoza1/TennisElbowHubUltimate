CREATE TABLE "player_known_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "player_known_names_player_id_name_unique" UNIQUE("player_id","name")
);
--> statement-breakpoint
ALTER TABLE "player_known_names" ADD CONSTRAINT "player_known_names_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;