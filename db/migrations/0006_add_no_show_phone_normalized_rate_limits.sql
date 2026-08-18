ALTER TYPE "public"."appointment_status" ADD VALUE 'no_show';--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "phone_normalized" text;--> statement-breakpoint
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "patients_phone_normalized_idx" ON "patients" USING btree ("phone_normalized");