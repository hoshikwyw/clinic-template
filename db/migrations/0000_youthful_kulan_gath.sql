CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"date_of_birth" date,
	"intake" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"service_id" text NOT NULL,
	"service_name" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_start_at_idx" ON "appointments" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE POLICY "patients_self_select" ON "patients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = "patients"."auth_user_id");--> statement-breakpoint
CREATE POLICY "patients_self_update" ON "patients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (auth.uid() = "patients"."auth_user_id");--> statement-breakpoint
CREATE POLICY "appointments_self_select" ON "appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.patients p where p.id = "appointments"."patient_id" and p.auth_user_id = auth.uid()));