# 00 — Overview & Strategy

## The product

A reusable clinic management platform that can be configured to serve **any type
of clinic** — dental, pediatric, physiotherapy, dermatology, general practice,
and more — without forking the codebase.

Delivered as **two apps + a public site** from one codebase:

| App | Who | Platforms |
|---|---|---|
| **Patient / Staff app** | Patients, doctors, staff (one role-aware app) | Web + PWA + **Android** (Capacitor); iOS later |
| **Admin Dashboard** | Clinic admin team | **Web only**, responsive (no Android build) |
| _Public site_ | Pre-login visitors | Web (SSR, for SEO) |

- Only the **Patient/Staff app** is wrapped into a native Android app.
- The **Admin Dashboard** is web-only but fully responsive/mobile-friendly.
- The Patient/Staff app is **one app, role-aware** (patient vs clinician views
  gated by role + RLS), not three separate apps.

## The core strategic decision

> **Don't fork the repo per clinic.** Copy-pasting a codebase per client means
> drowning in maintenance.

Instead, this is **one configuration-driven codebase** that we configure per
clinic and deploy as that clinic's own instance:

> **One codebase + one config = one clinic, ready to deploy.**

- ~**80% core** is identical across all clinics: appointments, patients, staff,
  scheduling, notifications, billing.
- ~**20% variable**: vocabulary, services, intake fields, branding.
- The 20% is **configuration**, not new code.

This single decision shapes the entire architecture (see
[02 — Architecture](./02-architecture.md)).

## Tenancy: single-tenant per deployment

The product is sold **per clinic**. Each clinic gets **their own deployment**
with **their own database** and **one config**:

| Per clinic sold | What they get |
|---|---|
| 1 deployment (Vercel) | their own app instance |
| 1 database (Supabase) | their data only — fully isolated |
| 1 clinic config (in code) | their branding, services, modules, intake form |
| their own Admin Dashboard | run by **the clinic's** admin team |

- **No shared multi-clinic database.** No `clinic_id`, no cross-tenant queries.
- **No vendor super-admin.** We don't run a dashboard over many clinics; each
  clinic manages itself.
- **Data isolation is total** — a clinic's data lives in its own Supabase
  project, which is the simplest and strongest privacy posture.

**Trade-off (accepted):** more deployments to provision as we grow (one per
clinic) in exchange for far simpler code and complete isolation. Because the app
is config-driven, the *same* code could later be pointed at a shared multi-tenant
database if we ever need that — the config would just load from a row instead of
a file. We are **not** building that now.

## What "easy migration" means concretely

- **Drizzle ORM** keeps the database portable (migrations as code).
- Supabase-specific code never leaks everywhere — it sits behind thin
  `auth` / `storage` wrappers.
- Native features sit behind a `packages/native` interface.
- If a client says "move us off Supabase / to AWS," we swap **adapters**, not
  features.

## Non-negotiables

- **Accessibility (WCAG 2.1 AA)** from day one — required for healthcare, and it
  is the baseline that makes the app usable for elderly patients.
- **Mobile-first** responsive design — the app must look good and fit on every
  screen size.
- **Role-based access enforced at the database** (RLS — patient vs doctor/staff),
  never trusting the app layer alone.
- **No PHI in logs/analytics**; audit logging for patient-data access.
