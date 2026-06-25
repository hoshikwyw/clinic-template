# 01 — Tech Stack

Every choice below is decided, with the reason. Deploy target is **Vercel**;
backend is **Supabase**.

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **Next.js (App Router) + TypeScript** | First-class on Vercel; SSR for SEO of public clinic pages; Server Actions cut API boilerplate |
| **Backend / DB** | **Supabase** (Postgres + Auth + Storage + RLS) | One platform = auth + DB + file storage; RLS enforces role-based access (patient vs staff). One Supabase project per clinic deployment |
| **Data access** | **Drizzle ORM** | Type-safe, lightweight, migrations as code → portable if we ever leave Supabase |
| **Styling** | **Tailwind CSS + shadcn/ui** | shadcn = we *own* the component code (not a locked dependency); accessible by default (Radix under the hood) |
| **State / data fetching** | **TanStack Query** + React Server Components | Caching, optimistic updates for booking; offline tolerance |
| **Forms** | **React Hook Form + Zod** | Zod schema = single source of truth for validation **and** TS types **and** config-driven intake forms |
| **i18n** | **next-intl** | Clinics serve different languages; baked in from day one. First languages: **English (`en`) + Myanmar (`my`)**, in-app switching — see [08](./08-i18n-languages.md) |
| **Email** | **Resend** | Appointment reminders / transactional email |
| **SMS** | **Provider-agnostic adapter** | Behind an interface so we can swap providers per region/budget |
| **Mobile / native** | **Capacitor** | Wraps the web codebase into a real Android app (+ iOS later) with ~95% code reuse — see [05](./05-web-mobile-strategy.md) |
| **Deploy** | **Vercel** | Given constraint |

## The vendor-wrapping principle

> Never let Supabase-specific (or any vendor-specific) code leak everywhere.
> **Wrap it.**

- **Drizzle** handles DB portability.
- A thin **`packages/auth`** wrapper isolates Supabase Auth.
- A thin **`lib` storage adapter** isolates Supabase Storage.
- **`packages/native`** isolates Capacitor plugins (push, camera, biometrics).
- The **SMS adapter** isolates the messaging provider.

Result: swapping any vendor is an adapter change, not a feature rewrite.

## Why not the alternatives (for the record)

- **React Native / Expo for mobile** — rejected: separate UI = double the work
  and a second skill set we can't afford now. (See [05](./05-web-mobile-strategy.md).)
- **A heavier ORM / Prisma** — Drizzle is lighter and keeps migrations as plain
  portable SQL-ish code.
- **A component library we don't own** — shadcn gives us the source, so we're
  never blocked by an upstream dependency.
