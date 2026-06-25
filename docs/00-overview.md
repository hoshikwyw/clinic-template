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

> **"Template" is a trap.** If we think "template," we copy-paste a repo per
> clinic and drown in maintenance.

Instead, this is a **single multi-tenant, configuration-driven product**:

> **One codebase + one config layer = any clinic.**

- ~**80% core** is identical across all clinics: appointments, patients, staff,
  scheduling, notifications, billing.
- ~**20% variable**: vocabulary, services, intake fields, branding.
- The 20% is **configuration**, not new code.

This single decision shapes the entire architecture (see
[02 — Architecture](./02-architecture.md)).

## Tenancy tiers (budget-driven delivery)

We are a startup with limited budget for database and hosting. Deploy target is
**Vercel + Supabase**. We design for the cheapest tier but keep migration easy.

| Tier | Model | Cost | When |
|---|---|---|---|
| **Tier 1** (default) | Single codebase, **one Supabase project**, multi-tenant by `clinic_id` + Row-Level Security. New clinic = a row + config. | Lowest | Our default; most clinics |
| **Tier 2** | Dedicated Supabase project / dedicated deploy per clinic. Same code, different env vars. | Higher | Clients who pay for isolation / compliance |

**Design for Tier 1. Keep the door open for Tier 2.** Moving a clinic from Tier 1
to Tier 2 should be an env/config change, not a rewrite — that is our "easy
migration" guarantee.

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
- **Multi-tenancy enforced at the database** (RLS), never trusting the app layer alone.
- **No PHI in logs/analytics**; audit logging for patient-data access.
