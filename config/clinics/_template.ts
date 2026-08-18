import { defineClinicConfig } from "@config-engine";

/**
 * ── NEW CLINIC STARTER ───────────────────────────────────────────────────────
 *
 * Copy this file to `config/clinics/<your-slug>.ts`, rename the export, fill in
 * the values marked `EDIT`, then point `config/clinic.ts` at it:
 *
 *     import { myClinic } from "./clinics/my-clinic";
 *     const activeClinic = myClinic;
 *
 * Or run `pnpm new-clinic <your-slug> "<Clinic Name>"` to scaffold this for you.
 *
 * Everything the app shows or behaves like comes from this object — no component
 * edits needed to rebrand. See config/clinics/smile-dental.ts (dental) and
 * little-stars-pediatric.ts (pediatric) for filled-in real examples, and
 * packages/config-engine/schema.ts for the full field reference + defaults.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const templateClinic = defineClinicConfig({
  // EDIT: stable internal id + URL-safe slug (used for the telehealth room, etc.)
  id: "clinic_template",
  slug: "template-clinic",
  // EDIT: "dental" | "pediatric" | "physio" | "dermatology" | "general" | any string
  specialty: "general",

  branding: {
    name: "Your Clinic Name", // EDIT
    shortName: "Clinic", // EDIT: short label for tight spaces / PWA
    // logoUrl: "https://…/logo.png",           // optional
    primaryColor: "oklch(0.55 0.18 250)", // EDIT: brand color (hex or oklch)
    // primaryForeground: "#ffffff",            // set if primaryColor is LIGHT
    // accentColor: "oklch(0.8 0.13 85)",       // optional
    // secondaryColor: "oklch(0.95 0.01 250)",  // optional
    radius: "0.625rem", // smaller = clinical, larger = friendly
    // font: "'Inter', system-ui, sans-serif",  // optional font stack
    // tokens: { "--background": "oklch(0.99 0 0)" }, // escape hatch: any CSS token
  },

  locale: {
    languages: ["en"], // EDIT: enabled languages; add "my" for Burmese
    defaultLang: "en", // must be one of `languages`
    timezone: "Asia/Yangon", // EDIT: IANA timezone
    currency: "MMK", // EDIT: ISO currency code shown next to prices
    phoneCountryCode: "95", // EDIT: dialling code, no "+". Dedupes patient phones.
  },

  // Turn features on/off. `billing` is a placeholder (not implemented yet).
  modules: {
    appointments: true,
    patients: true,
    scheduling: true,
    notifications: true,
    billing: false,
    staff: true,
    telehealth: false,
  },

  // EDIT: the bookable services. `id` must be unique.
  services: [
    { id: "consultation", name: "Consultation", durationMinutes: 30, price: 20000 },
    // { id: "video", name: "Video Consultation", durationMinutes: 20, telehealth: true },
  ],

  // EDIT: clinic-specific intake questions (rendered + validated by form-engine).
  // Field types: text | textarea | email | password | phone | number | date |
  // select | radio | checkbox. See packages/form-engine/schema.ts.
  intakeForm: [
    {
      name: "reason",
      label: "Reason for visit",
      type: "textarea",
    },
  ],

  bookingRules: {
    leadTimeHours: 2, // earliest bookable slot = now + this
    cancellationWindowHours: 24, // must cancel/reschedule at least this far ahead
    // maxPerDayPerPatient: 1,
  },

  businessHours: {
    openDays: [1, 2, 3, 4, 5], // 0=Sun … 6=Sat
    openTime: "09:00",
    closeTime: "17:00",
    slotMinutes: 30, // slot granularity
    bookingHorizonDays: 30, // how far ahead patients may book
  },

  // Labels for the booking contact step (relabel e.g. for a guardian).
  // bookingContact: {
  //   nameLabel: "Full name",
  //   phoneLabel: "Phone number",
  //   emailLabel: "Email (optional)",
  // },

  // Public site content (all optional).
  // about: "A sentence or two about the clinic for the landing page.",
  doctors: [
    // { name: "Dr. …", role: "…", bio: "…" },
  ],
  contact: {
    // phone: "+95 9 …",
    // email: "hello@yourclinic.example",
    // address: "…",
    // coordinates: { lat: 16.8409, lng: 96.1735 },
  },
  faq: [
    // { question: "Do I need an account to book?", answer: "No — you can book as a guest." },
  ],

  // Role labels for the staff directory.
  staffRoles: ["doctor", "nurse", "receptionist"],
});
