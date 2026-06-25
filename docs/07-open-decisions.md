# 07 — Open Decisions

Decisions to lock down before / during the build. Update this file as we resolve them.

| # | Decision | Options | Recommendation | Status |
|---|---|---|---|---|
| 1 | **Multi-tenancy model** | Single Supabase + RLS (Tier 1) vs per-clinic projects (Tier 2) | **Single Supabase + RLS** (cheapest, easy to migrate up later) | ⬜ Open |
| 2 | **Mobile delivery** | Capacitor (Play Store) vs PWA-only | **Capacitor** path; PWA-first to ship faster, Capacitor build follows | ⬜ Open |
| 3 | **Play Store: now or later?** | Store listing at launch vs installable PWA first | PWA-first lets us ship faster | ⬜ Open |
| 4 | **First two pilot specialties** | e.g. dental, pediatric, physio, dermatology, general | Pick **two genuinely different** ones to de-risk reusability | ⬜ Open |
| 5 | **Compliance bar / region** | HIPAA (US), GDPR (EU), other | Drives how hard we lean on audit logging & data residency *now* | ⬜ Open |

## Notes / context

- **#1** — We design for Tier 1 regardless; #1 only decides whether any first
  client needs Tier 2 isolation on day one.
- **#2 / #3** — Capacitor is the chosen architecture either way; the only
  question is whether the Play Store listing ships at launch or shortly after.
- **#4** — Two *contrasting* specialties in Phase 3 is the single best
  de-risking move for the whole "reusable for all clinics" claim.
- **#5** — Real medical compliance may require paid Supabase/hosting tiers; our
  vendor-wrapping keeps that an env/config change.

## Resolved decisions (move items here as we lock them)

_(none yet)_
