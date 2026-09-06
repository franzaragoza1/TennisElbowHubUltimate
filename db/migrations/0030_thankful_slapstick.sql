CREATE TABLE "rate_limit_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
