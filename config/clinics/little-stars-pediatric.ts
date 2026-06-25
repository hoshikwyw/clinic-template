import { defineClinicConfig } from "@config-engine";

/**
 * Sample clinic #2 — a PEDIATRIC clinic.
 * Deliberately different from the dental clinic to prove reusability:
 * telehealth on, billing off, different services + a guardian-oriented intake.
 */
export const littleStarsPediatric = defineClinicConfig({
  id: "clinic_little_stars",
  slug: "little-stars-pediatric",
  specialty: "pediatric",
  branding: {
    name: "Little Stars Children's Clinic",
    shortName: "Little Stars",
    primaryColor: "oklch(0.68 0.17 150)", // friendly green
    accentColor: "oklch(0.8 0.13 85)",
    radius: "1rem", // softer, rounder for a kids' brand
  },
  locale: {
    languages: ["en", "my"],
    defaultLang: "my",
    timezone: "Asia/Yangon",
    currency: "MMK",
  },
  modules: {
    appointments: true,
    patients: true,
    scheduling: true,
    notifications: true,
    billing: false,
    staff: true,
    telehealth: true,
  },
  services: [
    { id: "wellbaby", name: "Well-baby Visit", durationMinutes: 30 },
    { id: "vaccination", name: "Vaccination", durationMinutes: 20 },
    { id: "sickvisit", name: "Sick Visit", durationMinutes: 30 },
    { id: "teleconsult", name: "Video Consultation", durationMinutes: 20 },
  ],
  intakeForm: [
    { name: "childName", label: "Child's full name", type: "text", required: true },
    {
      name: "dateOfBirth",
      label: "Child's date of birth",
      type: "date",
      required: true,
    },
    {
      name: "guardianName",
      label: "Parent / guardian name",
      type: "text",
      required: true,
    },
    { name: "guardianPhone", label: "Guardian phone", type: "phone", required: true },
    {
      name: "weightKg",
      label: "Child's weight (kg)",
      type: "number",
      min: 0,
      max: 150,
    },
    {
      name: "visitType",
      label: "Type of visit",
      type: "radio",
      required: true,
      options: [
        { label: "Well-baby check", value: "wellbaby" },
        { label: "Vaccination", value: "vaccination" },
        { label: "Sick visit", value: "sick" },
      ],
    },
    { name: "symptoms", label: "Symptoms / concerns", type: "textarea" },
  ],
  bookingRules: {
    leadTimeHours: 1,
    cancellationWindowHours: 12,
    maxPerDayPerPatient: 1,
  },
  staffRoles: ["pediatrician", "nurse", "receptionist"],
});
