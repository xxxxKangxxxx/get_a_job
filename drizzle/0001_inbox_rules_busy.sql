CREATE TABLE "busy_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"start" text,
	"end" text,
	"title" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'google' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hide_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "inbox_state" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "inbox_prev" jsonb;--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "hidden_by_rule" integer;--> statement-breakpoint
CREATE INDEX "busy_blocks_date_idx" ON "busy_blocks" USING btree ("date");--> statement-breakpoint
UPDATE "postings" SET "inbox_state" = 'seen' WHERE "decision" <> '';