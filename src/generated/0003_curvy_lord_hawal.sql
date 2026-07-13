ALTER TABLE "feed" ADD COLUMN "last_fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "feed" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;