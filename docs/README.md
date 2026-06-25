# Clinic Platform — Project Documentation

> Single source of truth for architecture, stack, and design decisions.
> Read this **before writing any code.**

This is the decision record for our reusable, multi-tenant clinic platform.
The product runs as a **responsive web app + installable PWA + Android app**
(iOS later), all from **one codebase**.

## Core idea (read this first)

> **One codebase + one config layer = any clinic.**

This is **not** a "template" we fork per clinic. It is a single multi-tenant,
configuration-driven product. ~80% of the machinery is identical across all
clinic types (appointments, patients, staff, scheduling, notifications). The
~20% that differs (vocabulary, services, intake fields, branding) is
**configuration**, not code.

## Document index

| Doc | What's in it |
|---|---|
| [00 — Overview & Strategy](./00-overview.md) | Vision, the "config product not template" decision, tenancy tiers |
| [01 — Tech Stack](./01-tech-stack.md) | Every chosen technology and the reason for it |
| [02 — Architecture](./02-architecture.md) | Config engine, feature modules, schema-driven forms, multi-tenancy, security |
| [03 — Folder Structure](./03-folder-structure.md) | Full directory layout and the rules behind it |
| [04 — UI / UX System](./04-ui-ux-system.md) | Design system for all ages (kids → elderly), accessibility, theming |
| [05 — Web + Mobile Strategy](./05-web-mobile-strategy.md) | Capacitor wrapper, render-split, native concerns |
| [06 — Roadmap & Phases](./06-roadmap-phases.md) | Phase 0–5 delivery plan |
| [07 — Open Decisions](./07-open-decisions.md) | Decisions still needed before / during build |
| [08 — i18n & Languages](./08-i18n-languages.md) | Multilingual support — **English + Myanmar**, Myanmar Unicode caveats |
| [WORKLOG](./WORKLOG.md) | **Dated journal** — what we decided/did each day, newest first |

## Guiding principles (the short version)

1. **Build the engine before the features.** The config + form + module +
   theming engine is what makes this a product instead of 20 forked templates.
2. **Wrap every vendor.** Supabase, storage, SMS, native APIs all sit behind
   our own interfaces, so migration is a config/adapter change — never a rewrite.
3. **Mobile-first, accessible by default.** Design for the smallest screen and
   the least confident user first; everything else scales up from there.
4. **Configuration over code.** A new clinic should be a row + a config, not a deploy.

## Standing reminder

> **At the end of every working session, add a new dated entry to
> [WORKLOG.md](./WORKLOG.md)** (newest first) — what we decided, what changed,
> what's still open, and what the next session should do. This is how we "call
> back the memory" later. Use the copy-paste template at the bottom of WORKLOG.md.
