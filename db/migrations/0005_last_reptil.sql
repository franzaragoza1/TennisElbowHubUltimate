CREATE TABLE "match_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer,
	"youtube_video_id" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"match_confidence" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_videos_youtube_video_id_unique" UNIQUE("youtube_video_id")
);
--> statement-breakpoint
ALTER TABLE "match_videos" ADD CONSTRAINT "match_videos_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;