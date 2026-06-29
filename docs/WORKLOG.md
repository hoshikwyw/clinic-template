# Worklog — dated project journal

> Chronological record of what we decided/did, newest first.
> Use this to "call back the memory" — re-read an entry to remember what we made
> on a given day. Add a new dated entry every working session.

---

## 2026-06-29

**Session focus:** Polished the public site into a real marketing landing page,
added Supabase Realtime notifications (staff + patient), admin reports, and dark
mode.

### Decisions made
- **Realtime via Supabase `postgres_changes`** — staff get live new-booking
  toasts; patients get live confirmation toasts. Required a **staff-select RLS
  policy** (role from the JWT `app_metadata`) + adding `appointments` to the
  `supabase_realtime` publication so the staff browser receives events under RLS.
  Patient side reused the existing self-select RLS (no DB change).
- **Dark mode = Light / Dark / System** — activates the already-defined `.dark`
  token set; same no-FOUC localStorage pattern as the a11y prefs; system mode
  follows the OS live.
- **Landing map = Google Maps no-key embed** driven by config
  `contact.coordinates` (falls back to geocoding `address`). No API key.
- **Status badge styling extracted** to a single `lib/status-styles.ts` (had been
  duplicated across 5 files).

### Done / changed
- **Public landing redesign** — config-driven `about` + `doctors` (team cards);
  modern hero (gradient, specialty pill, Book + Call), services cards,
  Visit/contact section with an **embedded map** + "Get directions"; **sticky
  header** with brand mark, smooth-scroll section nav (#services/#team/#contact),
  and an always-visible **Book** CTA; refined header action styling.
- **Realtime** — `RealtimeNotifier` (admin: new appointment) +
  `PatientRealtimeNotifier` (portal: confirmed/completed); `sonner` toasts +
  `<Toaster>`. Uses the browser Supabase client (previously unused).
- **DB** — migration `0003` (appointments staff-select RLS policy + `ALTER
  PUBLICATION supabase_realtime`) generated **and applied to live Supabase**;
  verified publication + both policies present.
- **Admin reports** — `/admin/reports` (total, by-status, 14-day daily bar chart,
  top services) via `getReportData` aggregation; added to admin nav.
- **Dark mode** — Theme toggle in `SettingsPanel`; root-layout pre-paint init
  extended; `ThemeListener` for OS changes; fixed hardcoded `completed` badge
  colors to be dark-aware (5 views).
- **Refactor** — shared `lib/status-styles.ts`; `lib/hours.ts` (extracted) reused
  by landing + help. New `npm run public` dev script (port 5122).
- Build green throughout; 22 Vitest tests still pass.

### Still open (see 07-open-decisions.md)
- **Burmese strings are Claude's translations** — native review pending (now also
  covers landing, reports, realtime, dark mode).
- **Live DB has migrations 0002 (`patients.locale`) + 0003 (staff RLS + realtime
  publication)** applied — re-run `pnpm db:migrate` if the DB is ever reset.
- **Telehealth public Jitsi**, **rate-limit public booking**, **audit logging** —
  still recommended before real PHI.
- **Realtime not click-tested end-to-end** this session (dev servers were down);
  verified at the DB + build level. Worth a live two-window test.
- Open decisions #3 Play Store · #5 Compliance bar/region.

### Next session should
- **Commit** the realtime / reports / dark-mode / refactor work. Live-test
  realtime in two windows (book as patient → staff toast; staff confirm →
  patient toast). Then optionally: staff appointment notes (unused `notes`
  column), a notification center, native Burmese review, or rate-limiting / audit
  logging.

---

## 2026-06-26

> Two sessions this date — newest first.

### Session 2 — Feature build-out: full i18n, Phase 3–5 features, tests, CI, security, PWA, help center

**Session focus:** Long build session — completed i18n everywhere, verified
reusability (Phase 3), added telehealth + staff management + settings/help pages,
redesigned the patient home, and added tests, CI, a security pass, and PWA install.

### Decisions made
- **Patient home = overview, not a form.** Booking wizard moved to its own
  `/book` page; home shows next appointment + Book CTA + services + help.
- **Settings & Help are dedicated pages** (in nav), not header dropdowns —
  Burmese labels made cramped toolbars worse.
- **Telehealth = public Jitsi (MVP).** UUID rooms, no API key; documented that
  real PHI needs an authenticated provider.
- **Per-patient email locale** — capture the patient's language at booking and
  email them in it (not just the clinic default).
- **Two dev servers** via separate `distDir`: `pnpm app` (5173) / `pnpm dash`
  (5174) so patient + admin run side-by-side.
- **Cron fails closed** — `/api/cron/reminders` is disabled (503) when
  `CRON_SECRET` is unset, instead of being publicly triggerable.

### Done / changed
- **i18n completed across the whole app** — booking wizard, auth pages, form
  validation messages, public page, admin dashboard, accessibility/settings
  controls, and **notification emails** (per-patient locale, locale-aware dates).
  All UI dates now follow the active locale (Phase 3 fix).
- **Phase 3 verified** — ran the pediatric config on the same code (Myanmar
  default, telehealth on, different services) with zero code changes; reverted to
  Smile Dental.
- **Patient app** — `/book`, redesigned `/portal` home (overview + service
  preselect), `/appointments` (cancel + reschedule), `/profile`, `/settings`,
  `/help`, bottom nav.
- **Admin app** — patients directory + record (`/admin/patients`), dashboard
  stats + patient links, staff & role management (`/admin/staff`), settings
  (`/admin/settings`), reschedule, and **CSV export** (`/admin/export`).
- **Modules** — telehealth (Jitsi `meetingUrl`/`isJoinable`); notifications
  threaded with patient locale.
- **DB** — added `patients.locale` column; migration `0002` generated **and
  applied to live Supabase**.
- **Settings** consolidated (was scattered toolbars) → `SettingsPanel` page.
- **Tests** — Vitest set up (native tsconfig paths); 22 tests across scheduling
  (timezone math), form-engine, telehealth, config-engine.
- **Docs/infra** — real root `README.md`; GitHub Actions CI (lint + test +
  build); **PWA** (config-driven `app/manifest.ts`, `icon.svg`, minimal service
  worker → installable).
- **Security pass** — fixed cron fail-open + escaped patient name in email HTML;
  verified auth guards, server-only data access, service-role key handling,
  `getUser()` token revalidation.
- Fixed admin sidebar title wrapping in Myanmar.

### Still open (see 07-open-decisions.md)
- **Burmese strings are Claude's translations** — native-speaker review still
  pending (now covers the whole app + emails + help).
- **FAQ/help content is single-language** (clinic-authored); per-language FAQ not
  built.
- **Security recommendations** (not bugs): rate-limit public booking, add audit
  logging, use an authenticated telehealth provider before real PHI.
- **All of this session's work is uncommitted** — the user handles git. Note the
  live DB now has the `patients.locale` column (migration 0002).
- Open decisions #2 Mobile (Capacitor + PWA-first ✓ shipped) · #3 Play Store ·
  #5 Compliance bar/region.

### Next session should
- **Commit** this large body of work first. Then optionally: a Claude-powered
  help chatbot (grounded in clinic config + FAQ), a native Burmese review,
  rate-limiting / audit logging for compliance, or `cap add android` to generate
  the native app.

---

### Session 1 — i18n English/Myanmar

**Session focus:** Re-oriented to the committed single-tenant state, then wired
in-app i18n with English ↔ Myanmar language switching (verified live).

### Decisions made
- **i18n approach = cookie-based locale (no URL routing).** Fits the
  single-tenant app and avoids touching the auth `proxy.ts`. Active locale comes
  from the `NEXT_LOCALE` cookie, validated against `config.locale.languages`.
- **Myanmar handled via font fallback**, not per-locale class — `Noto Sans
  Myanmar` appended to the body font stack so Burmese glyphs render in any locale.
- **i18n coverage is incremental** — wired the pipeline + portal page first;
  remaining strings migrate to `t()` over time. Rule: no hardcoded user-facing
  strings now that the machinery exists.

### Done / changed
- Installed **next-intl v4.13**.
- `i18n/request.ts` (cookie locale + validation + message loading);
  `next.config.ts` wrapped with `createNextIntlPlugin`.
- Root `app/layout.tsx`: async, `getLocale()`, `NextIntlClientProvider`,
  `<html lang>` per locale, `Noto_Sans_Myanmar` font; `globals.css` body
  font-stack fallback.
- `lib/i18n/actions.ts` (`setLocale` server action) + `LanguageSwitcher`
  (`packages/ui/i18n/`, exported from `@ui`), placed in the portal header beside
  the accessibility toolbar.
- Expanded `locales/en.json` + `locales/my.json` (added `portal` namespace);
  translated portal page strings via `getTranslations`.
- **Verified live:** build green; `/portal` renders English by default and full
  Burmese under the `my` cookie; `<html lang>` switches `en`→`my`.
- Confirmed Supabase is already connected (Phases 0–2 were committed before this
  session); did **not** run the old multi-clinic seed (obsolete after single-tenant).

### Still open (see 07-open-decisions.md)
- **Burmese strings are Claude's translations** — need a native-speaker review
  before real patient use.
- i18n coverage gaps: **booking wizard, admin dashboard, login/signup** still
  hardcoded English.
- Open decisions #2 Mobile delivery (Capacitor, PWA-first) · #3 Play Store
  now/later · #5 Compliance bar/region.
- This session's work is **uncommitted** — the user handles git.

### Next session should
- Expand i18n coverage (booking wizard + admin + auth → `t()`) and get a Burmese
  review, OR start **Phase 3** (pediatric config as a contrasting clinic), OR
  begin **Phase 4** modules (billing / telehealth).

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
