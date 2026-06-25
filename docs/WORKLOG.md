# Worklog — dated project journal

> Chronological record of what we decided/did, newest first.
> Use this to "call back the memory" — re-read an entry to remember what we made
> on a given day. Add a new dated entry every working session.

---

## 2026-06-25

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
