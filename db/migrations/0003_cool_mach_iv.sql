CREATE POLICY "appointments_staff_select" ON "appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'staff'));--> statement-breakpoint
-- Enable Supabase Realtime for appointments (idempotent).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;