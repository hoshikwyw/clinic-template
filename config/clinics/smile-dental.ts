import { defineClinicConfig } from "@config-engine";

/**
 * Sample clinic #1 — a DENTAL clinic.
 * Demonstrates: telehealth off, dental-specific services + intake.
 * Billing is OFF for now — clinics handle their own billing outside the app.
 * Replace with real clients later (or load from DB).
 */
export const smileDental = defineClinicConfig({
  id: "clinic_smile_dental",
  slug: "smile-dental",
  specialty: "dental",
  branding: {
    name: "Smile Dental Clinic",
    shortName: "Smile",
    primaryColor: "oklch(0.55 0.18 250)", // blue
    radius: "0.625rem",
  },
  locale: {
    languages: ["en", "my"],
    defaultLang: "en",
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
    telehealth: false,
  },
  services: [
    { id: "checkup", name: "Dental Check-up", durationMinutes: 30, price: 20000 },
    { id: "cleaning", name: "Scaling & Cleaning", durationMinutes: 45, price: 35000 },
    { id: "filling", name: "Filling", durationMinutes: 60, price: 50000 },
    { id: "extraction", name: "Tooth Extraction", durationMinutes: 45, price: 40000 },
  ],
  // Canonical contact fields (name, phone) are collected by the booking wizard.
  // The intake form holds clinic-specific clinical questions only.
  intakeForm: [
    {
      name: "reason",
      label: "Reason for visit",
      type: "select",
      required: true,
      options: [
        { label: "Pain / toothache", value: "pain" },
        { label: "Routine check-up", value: "checkup" },
        { label: "Cleaning", value: "cleaning" },
        { label: "Cosmetic", value: "cosmetic" },
      ],
    },
    {
      name: "lastVisit",
      label: "Date of last dental visit",
      type: "date",
    },
    {
      name: "bleedingGums",
      label: "Do you have bleeding gums?",
      type: "checkbox",
    },
    { name: "notes", label: "Anything else we should know?", type: "textarea" },
  ],
  bookingRules: {
    leadTimeHours: 2,
    cancellationWindowHours: 24,
  },
  businessHours: {
    openDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
    openTime: "09:00",
    closeTime: "17:00",
    slotMinutes: 30,
    bookingHorizonDays: 30,
  },
  staffRoles: ["dentist", "hygienist", "receptionist"],
});
