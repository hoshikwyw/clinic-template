# 05 — Web + Mobile Strategy

The product is **not web-only**. We need a responsive web app **and** an Android
app, both looking good and fitting every screen — without doubling the work or
the budget.

## The decision: **Capacitor**

We build **one responsive web app** and use **Capacitor** to wrap it into a real
Android app we can publish to the Play Store — same React/Next codebase, no
second UI to maintain. iOS later is the same wrapper, ~free.

### Why Capacitor (the comparison)

| Path | What it is | Code reuse | Cost | Verdict |
|---|---|---|---|---|
| **React Native / Expo** | Separate native app, shared *logic* only | ~40% | High (two UIs, two skill sets) | ❌ Too expensive now |
| **PWA only** | Installable web app, no Play Store | 100% | Lowest | ⚠️ Good, but no store presence |
| **Responsive Web + PWA + Capacitor** | One web codebase wrapped into a native Android shell | ~95% | Low | ✅ **Our path** |

Result: **one team, one codebase, one design system → web + installable PWA +
Android (+ iOS later).** The only budget-correct choice.

## The two apps — only one gets the Android build

We ship **two apps** from the one codebase, plus the public site:

| App | Who | Platforms |
|---|---|---|
| **Patient / Staff app** (`(app)/`) | Patients, doctors, staff (role-aware) | **Web + PWA + Android** (Capacitor) |
| **Admin Dashboard** (`(admin)/`) | Clinic admin team | **Web only**, responsive — **no** Android build |
| _(Public site)_ (`(public)/`) | Pre-login visitors | Web (SSR) |

> **Only the Patient/Staff app gets wrapped by Capacitor into Android.** The
> Admin Dashboard is web-only but fully responsive/mobile-friendly. The
> Patient/Staff app is **one role-aware app**, not separate patient/doctor/staff
> apps — views are gated by role + RLS + UI permissions.

## Consequence: render split

Capacitor wants **static / client-rendered** output for the app shell, but we
want **SSR** for public marketing/booking pages (SEO matters for clinics getting
found on Google). So we split by zone:

- **Public pages** (`(public)/`) → **SSR** on Vercel — great SEO.
- **App zones** (`(app)/`, `(admin)/`) → **client-rendered SPA-style**. The
  `(app)/` zone is what **Capacitor packages** into Android; `(admin)/` stays
  web-only. Both are behind login, so no SEO needed.

## Native concerns we design for early (cheap now, painful later)

- **Push notifications** — appointment reminders via native push (Capacitor) on
  Android, web-push on browser. Behind the `notifications` module's adapter.
- **Offline tolerance** — clinics have spotty wifi. TanStack Query caching +
  service worker = app survives network blips. Design for "read works offline,
  writes queue."
- **Safe areas / notches** — respect device safe-area insets.
- **App-store assets** — icons, splash screens, store listings. Eventually part
  of per-clinic config (Tier 2 clinics may want their own branded app).

## Vendor wrapping

Native features go through **`packages/native`** (our interface), so:
- the web build **degrades gracefully** (web-push instead of native push), and
- we are **never locked in** to Capacitor.

## Honest caveat

Capacitor is a web-view wrapper — perfect for **content + forms + dashboards**
apps, which is exactly what a clinic system is. It is **not** the choice for
heavy native animation / 60fps gaming-grade UI. We don't need that. If a Tier-2
client ever demands a fully native experience, that's a funded, separate
decision — and our shared business logic (schemas, API layer, types) still
carries over.

## Impact on phasing

**Phase 0 now includes standing up the Capacitor wrapper** and running a "hello
clinic" build on a real Android device/emulator — not just on Vercel. We prove
web **and** Android in the same pipeline before building features.
