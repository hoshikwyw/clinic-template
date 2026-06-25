# 06 — Roadmap & Phases

Five phases. **Resist building all modules at once — prove the *engine* first.**

> Senior rule: **Build the engine before the features.** The temptation is to
> code an appointments screen on day one because it's tangible. Don't. The thing
> that makes this a *product* instead of 20 forked templates is the
> **config + form + module + theming engine** in Phase 1.

---

## Phase 0 — Foundation & spike (1–2 wks)

Stand up the full pipeline end-to-end:
- Repo, CI
- Tailwind + shadcn, **design tokens**
- Supabase project, **Drizzle + first migration**
- **Auth wrapper**
- i18n scaffold (next-intl)
- **Capacitor wrapper** — "hello clinic" running on a real Android device/emulator
- Deploy "hello clinic" to **Vercel**

**Goal:** the pipeline works end-to-end — **web AND Android** — before any feature.

## Phase 1 — Config & form engine (the differentiator)

- Clinic **config model + loader** (`packages/config-engine`)
- **Schema-driven form engine** (`packages/form-engine`)
- Branding / theming via **design tokens**

**Goal:** spin up a clinic from config alone — **no code**. (RLS arrives in
Phase 2 with the first real tables; it's **role-based** within the clinic, not
tenant-based.)

## Phase 2 — Core MVP modules

- `patients`, `appointments`, `scheduling`, `notifications` (reminders)
- Build the **booking wizard** here with full accessibility + mobile-first UI.

**Goal:** one pilot clinic actually books patients.

## Phase 3 — Prove reusability with 2 contrasting configs

- Configure **two different specialties** (e.g. dental + pediatric) from the
  **same codebase** — each as its own config (and, when sold, its own deploy).
- This is the real test of reusability — it exposes every hardcoded assumption.
- **Fix the engine, not the configs.**

**Goal:** prove reusability is real, not imaginary.

## Phase 4 — Expansion modules

- `billing`, `telehealth`, `staff`, patient portal, reporting/analytics — all as
  **toggleable modules**.
- **Admin UI** to edit config without engineers.

**Goal:** clinics self-describe; engineers stop being in the loop for setup.

## Phase 5 — Scale & onboarding

- **Repeatable per-clinic provisioning** (templated deploy + Supabase per clinic)
- Self-serve / fast onboarding of a new clinic from a config
- Performance, deeper compliance
- (Optional, only if ever needed) a shared multi-tenant mode — the config-driven
  design allows it without rewriting features

**Goal:** standing up a new clinic is fast and repeatable.

---

## The one piece of senior advice

Get **two genuinely different clinics** running on the engine in **Phase 3**
*before* building billing/telehealth — that's when you find out if your
reusability is real.
