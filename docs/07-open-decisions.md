# 07 — Open Decisions

Decisions to lock down before / during the build. Update this file as we resolve them.

| # | Decision | Options | Recommendation | Status |
|---|---|---|---|---|
| 2 | **Mobile delivery** | Capacitor (Play Store) vs PWA-only | **Capacitor** path; PWA-first to ship faster, Capacitor build follows | ⬜ Open |
| 3 | **Play Store: now or later?** | Store listing at launch vs installable PWA first | PWA-first lets us ship faster | ⬜ Open |
| 5 | **Compliance bar / region** | HIPAA (US), GDPR (EU), other | Drives how hard we lean on audit logging & data residency *now* | ⬜ Open |

## Notes / context

- **#2 / #3** — Capacitor is the chosen architecture either way; the only
  question is whether the Play Store listing ships at launch or shortly after.
- **#5** — Real medical compliance may require paid Supabase/hosting tiers; our
  vendor-wrapping keeps that an env/config change.

## Resolved decisions

- **#1 Tenancy model → SINGLE-TENANT per deployment** (2026-06-25). The app is a
  template sold per clinic: each clinic = its own deployment + own Supabase + one
  config in code. No shared multi-clinic DB, no `clinic_id`, no vendor
  super-admin. RLS is role-based within the clinic. See
  [00 — Overview](./00-overview.md) and [02 — Architecture](./02-architecture.md).
- **#6 Audit logging → BUILT** (2026-08-18). `audit_log` + `modules/audit`
  record every staff-facing access to patient data, with no PHI in the entries
  themselves. This was listed as a security recommendation for three sessions;
  it is no longer outstanding. Retention policy is still undecided — see #5.
- **#4 Sample clinic → Dental (Smile Dental)** (2026-06-25). One sample clinic
  shown for now; the engine is config-driven so other specialties are just
  different configs (see `config/clinics/` examples).
