ALTER TABLE "bookings" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calendar_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_calendar_token_key" UNIQUE("calendar_token");