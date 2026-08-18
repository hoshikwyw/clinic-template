# 09 — New Clinic Checklist (Rebrand & Launch)

How to turn this template into a running clinic. A new clinic is **config, not
code** — you edit one config object and deploy. Budget ~30 minutes for a rebrand
(plus Supabase setup).

> One clinic = one deployment (its own Vercel project + its own Supabase). See
> [00 — Overview](./00-overview.md).

## 1. Scaffold the clinic config

```bash
pnpm new-clinic <slug> "Clinic Name"     # e.g. pnpm new-clinic smile-dental "Smile Dental"
```

This creates `config/clinics/<slug>.ts` from the starter template with the id,
slug, and name filled in. Then make it live in [`config/clinic.ts`](../config/clinic.ts):

```ts
import { smileDental } from "./clinics/smile-dental";
const activeClinic = smileDental;
```

(You can also copy `config/clinics/_template.ts` by hand.)

## 2. Rebrand (the part that changes per clinic)

Edit `branding` in your new config — everything is token-driven, so no component
edits:

- [ ] `name` / `shortName` — clinic name (shows in header, title, emails, PWA)
- [ ] `primaryColor` — the brand color (hex or `oklch(...)`)
- [ ] **`primaryForeground`** — set this **if `primaryColor` is light**, or button
      text becomes unreadable (defaults to the theme's near-white otherwise)
- [ ] `accentColor` / `secondaryColor` — optional
- [ ] `radius` — corner roundness (smaller = clinical, larger = friendly)
- [ ] `font` — optional font stack
- [ ] `logoUrl` — optional
- [ ] `tokens` — escape hatch to override **any** design token from config, e.g.
      `{ "--background": "oklch(0.99 0 0)" }`

Colors accept any CSS color. See [04 — UI/UX System](./04-ui-ux-system.md).

## 3. Configure the clinic's behavior

- [ ] `specialty`, `locale` (languages, defaultLang, timezone, currency)
- [ ] `modules` — turn features on/off (`billing` is a placeholder, not yet built)
- [ ] `services` — bookable services (unique `id`s, durations, prices)
- [ ] `intakeForm` — clinic-specific questions (rendered + validated by form-engine)
- [ ] `businessHours`, `bookingRules`
- [ ] `locale.phoneCountryCode` — dialling code without `+` (e.g. `"95"`). Set
      this: it is what lets `09771…` and `+959771…` resolve to one patient
      instead of two records.
- [ ] `notifications` — `channels` and `reminderHoursBefore`.
      **Consider `"sms"`.** `patients.phone` is required and `patients.email` is
      not, so an email-only clinic reaches only the fraction of patients who
      gave an address — and reminders are the feature with a measurable return
      (fewer no-shows). SMS needs `locale.phoneCountryCode`, and the gateway is
      env, not config (`SMS_PROVIDER` — see `.env.example`); `webhook` mode
      takes a local carrier's HTTP endpoint with no code change.
- [ ] `businessHours.breaks` — recurring lunch / cleaning / ward-round blocks
- [ ] `businessHours.exceptions` — public holidays, closures, special openings
- [ ] `providers` — the bookable clinicians (or chairs, or rooms). Each gets its
      own calendar, so a clinic with three dentists can run three parallel
      appointments. Optional: with none configured the clinic behaves as a
      single calendar, exactly as before.
      - `serviceIds` — omit for "performs everything"
      - `hours` — personal working pattern, **intersected** with the clinic's
        (a provider can never open a day the clinic has closed)
      - `bookable: false` — on leave or departed, but kept so their past
        appointments still show their name
      - The public site's team section (`doctors`) is derived from this list,
        so describe the team once.
- [ ] `contact`, `about`, `doctors`, `faq` — public-site content
- [ ] `staffRoles` — role labels for the staff directory

The config is validated at load: bad values (e.g. `defaultLang` not in
`languages`, duplicate service ids, `openTime` after `closeTime`, a holiday date
that is not a real calendar day, hours declared on a day marked closed, a
telehealth service without the telehealth module) fail fast with a clear error.

> **`exceptions` are dated, so they need a yearly pass.** Once a holiday is in
> the past it simply stops matching — nothing breaks, but the clinic will start
> taking bookings on next year's holiday unless the dates are refreshed. Put a
> reminder in the clinic's calendar when you hand over.

## 4. Swap the app icons

Replace the static assets with the clinic's icon (keep the filenames):

- [ ] `app/icon.svg` (app icon + favicon)
- [ ] `app/favicon.ico`
- [ ] `public/icon.svg` (PWA)

The PWA manifest name/colors come from the config automatically.

## 5. Database + auth (Supabase)

- [ ] Create a Supabase project for this clinic
- [ ] Copy `.env.example` → `.env.local` and fill the values
      (see [SETUP](./SETUP.md) for which URL goes where — local uses the direct
      5432 connection, Vercel uses the 6543 pooler)
- [ ] `pnpm db:migrate`
- [ ] Create the first admin: sign up in the app, then
      `pnpm set-role you@example.com admin`

## 6. Deploy

- [ ] Push and import into Vercel; set the same env vars (use the **pooler** URL
      for `DATABASE_URL` in Vercel)
- [ ] Re-enable Supabase "Confirm email" for production
- [ ] The reminder cron is already wired in [`vercel.json`](../vercel.json)

See [SETUP](./SETUP.md) for the detailed Vercel/Supabase steps.

## Per-clinic change summary

Everything that differs between clinics lives in **one file** (`config/clinics/<slug>.ts`)
plus **three icon assets** and the **env/Supabase project**. Nothing in
`app/`, `modules/`, or `packages/` should need editing to launch a new clinic —
if it does, that's a bug in the template.
