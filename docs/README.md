# Clinic Platform — Project Documentation

> Single source of truth for architecture, stack, and design decisions.
> Read this **before writing any code.**

This is the decision record for our reusable clinic platform — a **configurable
template sold per clinic**. The product runs as a **responsive web app +
installable PWA + Android app** (iOS later), all from **one codebase**.

## Core idea (read this first)

> **One codebase + one config = one clinic, ready to deploy.**

This is a **configuration-driven template**: one codebase that you configure per
clinic and deploy as that clinic's own instance (**single-tenant** — one
deployment, one clinic, one database). ~80% of the machinery is identical across
all clinic types (appointments, patients, staff, scheduling, notifications). The
~20% that differs (vocabulary, services, intake fields, branding) is
**configuration**, not code.

## Document index

| Doc | What's in it |
|---|---|
| [00 — Overview & Strategy](./00-overview.md) | Vision, the "config product not template" decision, tenancy tiers |
| [01 — Tech Stack](./01-tech-stack.md) | Every chosen technology and the reason for it |
| [02 — Architecture](./02-architecture.md) | Config engine, feature modules, schema-driven forms, single-tenant model, security |
| [03 — Folder Structure](./03-folder-structure.md) | Full directory layout and the rules behind it |
| [04 — UI / UX System](./04-ui-ux-system.md) | Design system for all ages (kids → elderly), accessibility, theming |
| [05 — Web + Mobile Strategy](./05-web-mobile-strategy.md) | Capacitor wrapper, render-split, native concerns |
| [06 — Roadmap & Phases](./06-roadmap-phases.md) | Phase 0–5 delivery plan |
| [07 — Open Decisions](./07-open-decisions.md) | Decisions still needed before / during build |
| [08 — i18n & Languages](./08-i18n-languages.md) | Multilingual support — **English + Myanmar**, Myanmar Unicode caveats |
| [SETUP](./SETUP.md) | **Hands-on checklist** — local dev, env, admin bootstrap, Vercel deploy |
| [WORKLOG](./WORKLOG.md) | **Dated journal** — what we decided/did each day, newest first |

## Guiding principles (the short version)

1. **Build the engine before the features.** The config + form + module +
   theming engine is what makes this a product instead of 20 forked templates.
2. **Wrap every vendor.** Supabase, storage, SMS, native APIs all sit behind
   our own interfaces, so migration is a config/adapter change — never a rewrite.
3. **Mobile-first, accessible by default.** Design for the smallest screen and
   the least confident user first; everything else scales up from there.
4. **Configuration over code.** Setting up a new clinic = editing one config +
   deploying their instance, never changing feature code.
5. **Single-tenant per deployment.** Each clinic gets its own deployment + its
   own database. No shared multi-clinic database, no vendor super-admin; the
   Admin Dashboard is run by the clinic's own admin team.

## Standing reminder

> **At the end of every working session, add a new dated entry to
> [WORKLOG.md](./WORKLOG.md)** (newest first) — what we decided, what changed,
> what's still open, and what the next session should do. This is how we "call
> back the memory" later. Use the copy-paste template at the bottom of WORKLOG.md.
