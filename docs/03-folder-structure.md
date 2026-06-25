# 03 — Folder Structure

```
clinic-platform/
├── app/                          # Next.js App Router
│   ├── (public)/                 # SSR — marketing/landing, public booking (SEO)
│   │   └── [clinic]/             #   tenant-scoped public pages
│   ├── (app)/                    # CSR — PATIENT/STAFF app (patients, doctors, staff)
│   │                             #   role-aware; Capacitor-packaged → Android + PWA
│   ├── (admin)/                  # CSR — ADMIN DASHBOARD (clinic admin team)
│   │                             #   web-only, responsive; NOT packaged to Android
│   └── api/                      # route handlers / webhooks
│
├── modules/                      # FEATURE MODULES — the reusable core (vertical slices)
│   ├── appointments/             #   each module is self-contained:
│   │   ├── components/           #     UI
│   │   ├── server/               #     server actions / data access
│   │   ├── schema.ts             #     Zod + DB schema
│   │   └── index.ts              #     public API of the module
│   ├── patients/
│   ├── scheduling/
│   ├── billing/
│   ├── notifications/
│   ├── staff/
│   └── telehealth/
│
├── packages/                     # CROSS-CUTTING FOUNDATIONS (horizontal layers)
│   ├── ui/                       #   design system (shadcn-based, mobile-first)
│   │   ├── primitives/           #     buttons, inputs (shadcn)
│   │   ├── patterns/             #     booking wizard, cards, lists
│   │   └── shell/                #     adaptive nav: bottom-bar ↔ sidebar
│   ├── config-engine/            #   clinic config loader + types
│   ├── form-engine/              #   schema-driven form renderer
│   ├── auth/                     #   auth wrapper (Supabase adapter)
│   └── native/                   #   Capacitor plugin wrappers (push, camera, storage)
│
├── db/
│   ├── schema/                   # Drizzle table definitions
│   ├── migrations/
│   └── rls/                      # Row-Level Security policies
│
├── lib/                          # pure utils, adapters (storage, SMS, ...)
├── config/
│   └── clinics/                  # per-clinic config (or seeded in DB)
├── locales/                      # i18n message files
├── tests/
│
├── android/                      # Capacitor native Android project (generated)
├── ios/                          # later — same wrapper
└── capacitor.config.ts           # native shell config
```

## The rules behind the structure

- **`modules/` are vertical slices.** Everything for "appointments" lives
  together (UI + server + schema + types). A developer finds any feature in
  seconds, and we can extract a module into a real package later.
- **`packages/` are horizontal foundations.** Used by every module
  (design system, config engine, form engine, auth, native).
- **`app/` zones map to the two apps + public site.** `(public)` = SSR for SEO;
  `(app)` = Patient/Staff app (role-aware, Capacitor-packaged → Android/PWA);
  `(admin)` = Admin Dashboard (web-only, responsive, **not** packaged to Android).
- **Vendors are wrapped, not scattered.** `packages/auth`, `packages/native`,
  and `lib` adapters isolate Supabase / Capacitor / SMS so migration is an
  adapter swap.
- **`db/rls/` is first-class.** RLS policies live in the repo, versioned with
  migrations — multi-tenancy is enforced at the database.
