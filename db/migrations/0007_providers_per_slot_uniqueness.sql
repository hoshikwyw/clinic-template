DROP INDEX "appointments_active_slot_unique";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "provider_id" text DEFAULT 'clinic' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "provider_name" text;--> statement-breakpoint
CREATE INDEX "appointments_provider_start_idx" ON "appointments" USING btree ("provider_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_active_slot_unique" ON "appointments" USING btree ("provider_id","start_at") WHERE status <> 'cancelled' and status <> 'no_show';