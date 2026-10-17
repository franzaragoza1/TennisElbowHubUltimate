CREATE TABLE "calendar_tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"iso_year" integer NOT NULL,
	"iso_week" integer NOT NULL,
	"competition" text,
	"draw_size" integer,
	"surface" text,
	"category" text,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_tournaments_event_name_iso_year_iso_week_unique" UNIQUE("event_name","iso_year","iso_week")
);
