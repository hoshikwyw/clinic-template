# Worklog — dated project journal

> Chronological record of what we decided/did, newest first.
> Use this to "call back the memory" — re-read an entry to remember what we made
> on a given day. Add a new dated entry every working session.

---

## 2026-06-25

> Two sessions this date — newest first.

### Session 2 — Phases 0, 1 & 2 build

**Session focus:** Scaffolded the project and built straight through Phases 0–2 —
a working clinic app: config-driven, books real appointments, patient + staff
auth, and notifications.

**Decisions made**
- **Single-tenant confirmed**; the multi-clinic DB approach was built then
  **reverted** (dropped the `clinics` table). Sample clinic = **Smile Dental**.
- **Auth = email + password**; **guest booking allowed** (book with name + phone,
  no account).
- **Roles come from Supabase `app_metadata`** (admin-only/secure), not
  user_metadata. `set-role` script bootstraps the first admin.
- **Capacitor remote-URL pattern** for Android (online SaaS — keep SSR, don't
  static-export).
- **Next 16 specifics:** `middleware.ts` → `proxy.ts` (renamed convention).
- **Git:** the user now handles all commits/pushes (Claude did the Phase 0
  commit + initial push to github.com/hoshikwyw/clinic-template; Phases 1–2 left
  uncommitted for the user).

**Done / changed**
- **Phase 0:** Next.js 16 + React 19 + TS + Tailwind v4 scaffold; full folder
  structure (`modules/`, `packages/`, `db/`, `config/`, `locales/`); shadcn/ui +
  design tokens + accessibility tokens (font-scale, high-contrast,
  reduced-motion, safe-area); Drizzle + Supabase wiring; Capacitor config; en/my
  i18n seed files. Committed + pushed.
- **Phase 1:** `config-engine` (Zod `ClinicConfig`), `form-engine`
  (schema-driven `FormRenderer` + `buildZodSchema`), theming
  (`ClinicThemeProvider`), single active clinic (`config/clinic.ts`).
- **Phase 2:** `patients` + `appointments` tables (role-based RLS) applied to
  Supabase; timezone-aware slot generation; **booking wizard**
  (service→time→details→intake→review→confirm); patient auth (signup/login/
  logout) + session-aware `/portal` + "my appointments"; **staff dashboard**
  `/admin` (confirm/cancel/complete, `requireStaff` guard, `set-role` script);
  **notifications** (Resend/console email adapter, booking + status emails,
  reminder cron `/api/cron/reminders` + `vercel.json`, `reminder_sent_at`).
- Verified booking flow and reminders against the live Supabase DB.

**Still open** (see 07-open-decisions.md)
- #2 Mobile delivery (Capacitor chosen, PWA-first) · #3 Play Store now/later ·
  #5 Compliance bar/region.
- **Manual setup for the user:** disable Supabase "Confirm email" for smooth dev
  login; switch `DATABASE_URL` to the **pooler (6543)** for Vercel runtime;
  optionally set `RESEND_API_KEY`/`EMAIL_FROM` + `CRON_SECRET` to actually send
  email (otherwise emails are console no-ops).

**Next session should**
- Start **Phase 3** (prove reusability: stand up the pediatric config as a
  contrasting clinic, fix hardcoded assumptions), OR begin **Phase 4** modules
  (billing/telehealth), OR wire the **i18n provider + language switcher** (en/my).

---

### Session 1 — Initial brainstorming & docs

**Session focus:** Initial brainstorming — set the whole project direction before
writing any code.

### Decisions made
- **Product framing:** This is **one configuration-driven codebase**, NOT a
  forked-per-clinic template. Core idea: *one codebase + one config = one clinic*.
- **Tenancy (revised same day):** **SINGLE-TENANT per deployment** — the app is a
  template sold per clinic; each clinic = its own deploy + own Supabase + one
  config in code. No shared multi-clinic DB, no `clinic_id`, no vendor
  super-admin. (Superseded the initial multi-tenant "Tier 1/2" idea.)
- **Tech stack locked:** Next.js (App Router) + TypeScript, Supabase (Postgres/Auth/Storage/RLS),
  Drizzle ORM, Tailwind + shadcn/ui, TanStack Query, React Hook Form + Zod, next-intl,
  Resend (email) + provider-agnostic SMS adapter, deploy on Vercel.
- **Web + Mobile:** Chose **Capacitor** to wrap the one web codebase into an Android app
  (+ iOS later), ~95% code reuse. Rejected React Native (too costly). PWA-first to ship faster.
- **Render split:** Public pages = SSR (SEO); app zones (portal/admin) = client-rendered SPA
  (packaged by Capacitor).
- **UI/UX:** One accessible, mobile-first, wizard-driven UI for ALL ages (kids → elderly).
  WCAG 2.1 AA baseline, design tokens, 44px+ targets, font-size toggle, simple mode,
  high-contrast/reduced-motion. Do NOT build age-specific UIs.
- **Vendor-wrapping principle:** Supabase/Capacitor/SMS all sit behind our own adapters so
  migration = swap adapter, not rewrite.
- **Build order:** Engine before features (config + form + module + theming engine first).

### Artifacts created (the docs set)
- `docs/README.md` — index + core idea + principles
- `docs/00-overview.md` — strategy & tenancy tiers
- `docs/01-tech-stack.md` — stack + reasons
- `docs/02-architecture.md` — config engine, modules, schema-driven forms, security
- `docs/03-folder-structure.md` — full directory layout
- `docs/04-ui-ux-system.md` — UI/UX for all ages
- `docs/05-web-mobile-strategy.md` — Capacitor + render split
- `docs/06-roadmap-phases.md` — Phase 0–5 plan
- `docs/07-open-decisions.md` — open-decisions tracker
- `docs/WORKLOG.md` — this dated journal

### Still open (see 07-open-decisions.md)
1. ~~Multi-tenancy model~~ → RESOLVED: single-tenant per deployment.
2. Mobile: Capacitor vs PWA-only (recommend Capacitor, PWA-first)
3. Play Store now or later?
4. ~~First two pilot specialties~~ → sample = Dental (Smile Dental) for now.
5. Compliance bar / region (HIPAA / GDPR / other)

### Next session should
- Resolve the 5 open decisions, OR
- Go deeper on one pillar (config schema spec, or design-tokens/theming spec), OR
- Start Phase 0 scaffolding.

---

## Template for future entries (copy this)

```
## YYYY-MM-DD

**Session focus:** <one line>

### Decisions made
- ...

### Done / changed
- ...

### Still open
- ...

### Next session should
- ...
```
