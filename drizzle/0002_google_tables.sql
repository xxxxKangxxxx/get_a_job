CREATE TABLE "google_accounts" (
	"id" text PRIMARY KEY DEFAULT 'me' NOT NULL,
	"email" text,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text DEFAULT '' NOT NULL,
	"calendar_id" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_event_links" (
	"key" text PRIMARY KEY NOT NULL,
	"calendar_id" text NOT NULL,
	"google_event_id" text NOT NULL,
	"hash" text NOT NULL,
	"date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
