CREATE TABLE "live_scores_cache" (
	"id" integer PRIMARY KEY NOT NULL,
	"matches" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
