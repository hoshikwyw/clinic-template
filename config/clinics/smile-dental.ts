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
  about:
    "Smile Dental Clinic has cared for families across Yangon for over 15 years. " +
    "Our team combines gentle, modern dentistry with a calm, welcoming space — " +
    "from routine check-ups to cosmetic work, you're in good hands.",
  doctors: [
    {
      name: "Dr. Aung Min",
      role: "Lead Dentist",
      bio: "15+ years in general and cosmetic dentistry. Gentle with anxious patients.",
    },
    {
      name: "Dr. Su Latt",
      role: "Orthodontist",
      bio: "Specialist in braces and aligners for children and adults.",
    },
    {
      name: "Dr. Kyaw Zin",
      role: "Oral Surgeon",
      bio: "Extractions, implants, and surgical care with a focus on comfort.",
    },
  ],
  contact: {
    phone: "+95 9 123 456 789",
    email: "hello@smiledental.example",
    address: "No. 12, Dental Street, Yangon",
    coordinates: { lat: 16.8409, lng: 96.1735 }, // central Yangon
  },
  faq: [
    {
      question: "Do I need an account to book?",
      answer:
        "No — you can book as a guest with just your name and phone number. Creating an account lets you view and manage your appointments.",
    },
    {
      question: "How do I cancel or reschedule?",
      answer:
        "Log in, open ‘Appointments’, and use Reschedule or Cancel. Changes must be made at least 24 hours before your appointment; after that, please call us.",
    },
    {
      question: "What should I bring to my visit?",
      answer:
        "Please arrive 10 minutes early with any previous dental records and a list of medications you take.",
    },
    {
      question: "Do you accept walk-ins?",
      answer:
        "We prioritise booked appointments, but we do our best to accommodate walk-ins when the schedule allows.",
    },
  ],
  staffRoles: ["dentist", "hygienist", "receptionist"],
});
