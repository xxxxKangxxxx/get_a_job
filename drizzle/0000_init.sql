CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"posting_id" text,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"job_category" text DEFAULT '' NOT NULL,
	"applied_at" date,
	"deadline" date,
	"stage" text NOT NULL,
	"history_note" text DEFAULT '' NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"user_edited_fields" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"date" date PRIMARY KEY NOT NULL,
	"available_hours" real NOT NULL,
	"input" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"checked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"posting_id" text,
	"application_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"time" text,
	"notes" text DEFAULT '' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postings" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"job_category" text DEFAULT '' NOT NULL,
	"company_type" text DEFAULT '' NOT NULL,
	"company_type_basis" text,
	"employment_type" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"open_date" date,
	"deadline" date,
	"deadline_time" text,
	"rolling" boolean DEFAULT false NOT NULL,
	"fit" text DEFAULT '' NOT NULL,
	"decision" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '진행중' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"surveyed_at" date,
	"origin" text DEFAULT 'collected' NOT NULL,
	"est_hours" real,
	"progress" integer DEFAULT 0 NOT NULL,
	"user_edited_fields" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "postings_deadline_idx" ON "postings" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "postings_status_idx" ON "postings" USING btree ("status");