# 02 — Architecture

The heart of the product is the **configuration engine**. It is what makes one
codebase serve every clinic. Build this **before** building features.

## Three pillars

### A. Clinic Config (the brain)

Each clinic is described by a config object that lives **in code per deployment**
(`config/clinic.ts`), validated with Zod at load. One deployment = one clinic =
one config. Example shape:

```ts
clinic: {
  branding:   { name, logo, colorScheme, font },
  locale:     { languages, defaultLang, timezone, currency },
  specialty:  "dental" | "pediatric" | "physio" | "general" | "...",
  modules:    { appointments: true, billing: false, telehealth: false, ... },
  services:   [ { name, duration, price, requiresRoom, ... } ],
  intakeForm: [ /* field definitions — schema-driven, not hardcoded */ ],
  staffRoles: [ ... ],
  bookingRules: { leadTime, cancellationWindow, ... },
}
```

### B. Feature Modules (the organs)

Build features as **toggleable modules**, not one monolith. A clinic enables
only the modules it needs. This is what lets one codebase serve everyone.

Core/expansion modules:
- `appointments`
- `patients`
- `scheduling`
- `notifications`
- `billing`
- `staff`
- `telehealth`

Each module is a **vertical slice** — its UI, hooks, server actions, schema, and
types are colocated, and it exposes a small public API via `index.ts`. See
[03 — Folder Structure](./03-folder-structure.md).

### C. Schema-driven forms (the killer feature)

Intake forms, patient fields, and service types differ wildly between, say, a
kids' clinic and a dermatology clinic. So forms are **rendered from config + Zod
schemas**, not hardcoded JSX.

Build the form **engine** once; every clinic just supplies field definitions.
This alone saves months across clinics and is a core differentiator.

## Tenancy: single-tenant per deployment

- **One clinic per deployment**, with **its own Supabase project**. No
  `clinic_id`, no cross-tenant queries, no shared multi-clinic database.
- The database holds **only that clinic's data**, so isolation is total.
- A new clinic = **edit the config + deploy a new instance**, not a DB row.
- RLS is **role-based within the clinic** (patient vs doctor/staff via Supabase
  Auth), not tenant-based. See [db/rls](../db/rls/README.md).

## Security & compliance (design early — painful to retrofit)

Healthcare data is high-stakes even on a budget:

- **Role-based RLS** (patient can see only their own records; staff per role),
  enforced at the database — never trust the app layer alone.
- **Audit logging** for any access to patient data (who saw what, when).
- **No PHI** in logs, analytics, or long-lived client-side state.
- Design for an eventual **HIPAA / GDPR** posture depending on region — costs
  little now, prevents a rebuild later.
- **Honest note:** real medical compliance (BAA with vendors, data residency)
  may eventually require paid Supabase/hosting tiers. Our wrapping strategy makes
  that an env/config change, not a rewrite.

## The two apps (+ public site)

We ship **two distinct apps** from the one codebase, plus the public site:

| App / zone | Who | Platforms | Render |
|---|---|---|---|
| **Public site** (`(public)/`) | Anyone (pre-login) | Web | **SSR** (SEO) |
| **Patient / Staff app** (`(app)/`) | Patients, doctors, staff | **Web + PWA + Android** (Capacitor) | **CSR** SPA-style, mobile-first |
| **Admin Dashboard** (`(admin)/`) | Clinic admin team | **Web only**, responsive (no Android build) | **CSR** SPA-style |

- The **Patient/Staff app is one app, role-aware** — same codebase, but the view
  (patient vs clinician) is gated by **role + RLS + UI permissions**, not three
  separate apps.
- **Only the Patient/Staff app gets the Capacitor/Android build.** The Admin
  Dashboard stays web-only but fully responsive (mobile-friendly).

## Render split (ties into mobile strategy)

- **Public pages** (`(public)/`) → **SSR** on Vercel for SEO (clinics need to be
  found on Google).
- **App zones** (`(app)/`, `(admin)/`) → **client-rendered SPA-style**. The
  `(app)/` zone is what Capacitor packages into the Android app; both are behind
  login and don't need SEO.

See [05 — Web + Mobile Strategy](./05-web-mobile-strategy.md).
