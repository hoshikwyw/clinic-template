import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients";

export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

/**
 * appointments — a booked slot for a service at THIS clinic.
 *
 * `serviceId` / `serviceName` reference the clinic config's services (services
 * live in config, not the DB) and snapshot the name at booking time.
 *
 * RLS: a logged-in patient can see only their own appointments. Trusted server
 * actions (Drizzle) bypass RLS and enforce authorization in app code.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull(),
    serviceName: text("service_name").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").default("pending").notNull(),
    notes: text("notes"),
    /** set once a reminder has been sent, so we never remind twice */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("appointments_start_at_idx").on(t.startAt),
    index("appointments_patient_idx").on(t.patientId),
    pgPolicy("appointments_self_select", {
      for: "select",
      to: "authenticated",
      using: sql`exists (select 1 from public.patients p where p.id = ${t.patientId} and p.auth_user_id = auth.uid())`,
    }),
    // Staff may read all appointments (role from the secure JWT app_metadata).
    // This also lets the staff browser receive Realtime events under RLS.
    pgPolicy("appointments_staff_select", {
      for: "select",
      to: "authenticated",
      using: sql`(auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'doctor', 'staff')`,
    }),
  ]
).enableRLS();

export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointmentRow = typeof appointments.$inferInsert;
