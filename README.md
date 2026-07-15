# Clinic Platform

A reusable, **configuration-driven clinic web app** — one codebase that becomes
any clinic by editing a single config. Patients book, reschedule, and cancel
appointments; staff manage the schedule, patients, and team. Bilingual
(English + Myanmar) end to end, mobile-first, and deployable to Vercel +
Supabase.

> Single-tenant per deployment: one deploy = one clinic. To launch a new clinic,
> point it at a different config (and its own Supabase) — no code changes.

## Features

- **Patient app** — overview home, book (config-driven services + intake form),
  reschedule, cancel, profile, appointment history
- **Admin dashboard** — appointment management (confirm / complete / cancel /
  reschedule) with daily stats, searchable patient directory + records, and
  admin-only staff & role management
- **Config-driven** — branding, services, intake forms, business hours, booking
  rules, enabled modules all live in one `ClinicConfig`
- **Schema-driven forms** — intake/booking forms render and validate from config
  (no hardcoded fields per clinic)
- **i18n** — English + Myanmar, in-app language switch, locale-aware dates, and
  **per-patient** notification emails
- **Telehealth** — video consultations via Jitsi (no API key) for flagged services
- **Notifications** — booking / status / reminder emails (Resend, or a console
  no-op without a key) + a reminder cron
- **Accessibility** — WCAG-minded, text-size + high-contrast controls, 44px+ targets
- **Auth & roles** — Supabase email/password, guest booking, roles in secure
  `app_metadata`

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Supabase (Postgres / Auth) · Drizzle ORM · next-intl · React Hook Form + Zod ·
Capacitor (Android) · Vitest · deploy on Vercel.

See [`docs/`](./docs) for the full architecture and decision records.

## Quick start

### Prerequisites

- Node 20+ and **pnpm**
- A **Supabase** project (free tier is fine)

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local` from your Supabase project (Settings → API / Database):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` — use the **connection pooler** URL (port 6543)
- Optional: `RESEND_API_KEY` + `EMAIL_FROM` (else emails are console no-ops),
  `CRON_SECRET` (protects the reminder cron)

### 3. Set up the database

```bash
pnpm db:migrate
```

### 4. Run

```bash
pnpm dev          # http://localhost:3000
# or run the two app windows side-by-side:
pnpm app          # patient app  → http://localhost:5173
pnpm dash         # admin         → http://localhost:5174/admin
```

### 5. Create the first admin

Sign up an account in the app, then promote it (roles can only be granted
server-side):

```bash
pnpm set-role -- you@example.com admin
```

After that, admins manage the whole team from **/admin/staff**.

## Setting up a new clinic

This is the point of the template — a new clinic is **config, not code**:

1. Copy a sample config in [`config/clinics/`](./config/clinics) (e.g.
   `smile-dental.ts`) and edit branding, services, intake form, business hours,
   booking rules, languages, and enabled modules.
2. Point [`config/clinic.ts`](./config/clinic.ts) at it (`activeClinic = ...`).
3. Give the clinic its own Supabase project + env, deploy.

The pediatric sample (`little-stars-pediatric.ts`) is a deliberately different
clinic — verified to run on this exact code (different services, Myanmar default,
telehealth on).

## Testing

```bash
pnpm test         # Vitest — scheduling, forms, telehealth, config
pnpm test:watch
```

## Build & deploy

```bash
pnpm build        # production build
```

Deploy to **Vercel** (set the same env vars). The reminder cron is wired via
[`vercel.json`](./vercel.json).

## Mobile (Android)

The patient app is wrapped with **Capacitor** (remote-URL pattern — keeps SSR).
Generate the native project with `pnpm cap:add:android` (needs Android Studio +
JDK), then point `capacitor.config.ts` `server.url` at your dev/prod URL. See
[`docs/05-web-mobile-strategy.md`](./docs/05-web-mobile-strategy.md).

## Project structure

```
app/         Next.js routes — (public) / (portal) patient app / (admin)
modules/     feature slices — appointments, patients, scheduling, notifications,
             telehealth, staff (billing is a placeholder — not yet implemented)
packages/    foundations — config-engine, form-engine, ui, auth, native
db/          Drizzle schema + migrations + RLS
config/      the active clinic + sample clinic configs
locales/     en / my message catalogs
docs/        architecture & decision records
tests/       Vitest suites
```

**Module boundaries:** each `modules/*` slice exposes its public API through its
`index.ts` barrel — import features via `@modules/<name>`, never from a module's
`server/` internals (enforced by ESLint `no-restricted-imports`). Enabling an
unimplemented module (e.g. `billing`) logs a dev-time warning.

See [`docs/03-folder-structure.md`](./docs/03-folder-structure.md) for the full map.
