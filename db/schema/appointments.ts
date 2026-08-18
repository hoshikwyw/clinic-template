import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { patients } from "./patients";

/**
 * `no_show` is what the clinic is actually buying reminders for: without it
 * there is no way to measure whether the product reduced missed appointments.
 * It is a terminal status like `cancelled` and, like `cancelled`, it releases
 * the slot (see appointments_active_slot_unique).
 */
export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

/**
 * Statuses that still hold a time slot. Cancelled and no-show appointments free
 * the time again, so they must never block availability, the daily per-patient
 * cap, or the unique-slot index. Keep this in lockstep with the index predicate
 * below — the DB is the authority, this is how the app agrees with it.
 */
export const OCCUPYING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
] as const;

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
    /**
     * Which provider's calendar this occupies. References a provider id in the
     * clinic config, exactly like serviceId references a service. Defaults to
     * the implicit single provider so clinics that configure none — and rows
     * written before providers existed — still have a real value to key the
     * unique-slot index on.
     */
    providerId: text("provider_id").notNull().default("clinic"),
    /** name snapshot, so history survives a provider leaving the config */
    providerName: text("provider_name"),
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
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("appointments_start_at_idx").on(t.startAt),
    index("appointments_patient_idx").on(t.patientId),
    // At most one active booking per provider per start time. Makes the booking
    // clash-check atomic at the DB level, closing the check-then-insert race in
    // createAppointment, while letting a clinic run as many parallel calendars
    // as it has providers.
    // Compared as the enum, NOT via `status::text`: enum-to-text is only
    // STABLE, and Postgres rejects a non-IMMUTABLE function in an index
    // predicate. That is also why adding the `no_show` label and rebuilding
    // this index have to be two separate migration files — a freshly-added
    // enum label cannot be used in the transaction that added it.
    uniqueIndex("appointments_active_slot_unique")
      .on(t.providerId, t.startAt)
      .where(sql`status <> 'cancelled' and status <> 'no_show'`),
    // Staff calendar views and availability both filter by provider + time.
    index("appointments_provider_start_idx").on(t.providerId, t.startAt),
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
