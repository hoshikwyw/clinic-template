# 04 — UI / UX System

## The hardest UX constraint

The same product must serve a 6-year-old's parent, a busy 30-year-old, and an
80-year-old with poor eyesight and low tech confidence — on web **and** mobile.

> The answer is **not** "one perfect UI" and it is **not** separate "kid UI" vs
> "elderly UI." It is **accessible defaults + adaptive density.**

We build **one calm, high-contrast, large-target, wizard-driven UI** that is
pleasant for everyone, plus a few toggles. That is cheaper than multiple UIs and
actually better for all ages.

## Foundational — non-negotiable, build once

- **WCAG 2.1 AA from day one.** Not optional for healthcare, and it *is* the
  elderly-friendly baseline: contrast ratios, focus states, keyboard nav,
  screen-reader labels.
- **Design tokens.** All color / spacing / typography / radius are tokens, so
  per-clinic branding = swap token values, never touch components.
- **Large touch targets (min 44×44px)** with generous spacing — helps elderly
  *and* kids/parents on phones.
- **Type scale that breathes.** Base 16px+, plus a built-in **font-size toggle
  (A / A+ / A++)**. Big win for elderly users, trivial with tokens.
- **Plain language, low reading level.** Microcopy reviewed for clarity, no
  medical jargon.

## Adaptive layers

- **Booking flow = wizard, one decision per screen.** Linear
  "pick service → pick time → confirm" with a progress bar works for every age
  and every screen size. Dense forms lose elderly users.
- **Icon + text always together** — never icon-only. Icons help kids /
  low-literacy; text helps elderly who don't recognize modern icon conventions.
- **High-contrast & reduced-motion modes.** Respect `prefers-reduced-motion`;
  offer a high-contrast theme. Cheap to build, big inclusivity payoff.
- **Optional "simple mode."** A lower-density layout with bigger everything and
  fewer options on screen. One config flag flips it.

## Mobile-first (not just mobile-friendly)

Design for the **smallest screen first**, then scale **up** — never the reverse.

- Responsive grid with `sm / md / lg / xl` breakpoints from day one.
- **Bottom navigation bar on mobile** (thumb-reachable) → **sidebar on desktop**.
  Same components, adaptive shell (`packages/ui/shell`).
- **Touch-first** interactions; hover states are enhancements, never requirements.
- Respect device **safe-area insets** (notches, home bar).
- **"Fits every screen" is a QA gate**, not a hope: test 320px narrow phone →
  tablet → desktop.

## Theming / branding

- Per-clinic branding (name, logo, color scheme, font) comes from the clinic
  **config** and maps onto **design tokens**.
- Changing a clinic's look = changing token values + config, never editing
  component code.

## Summary rule

> One accessible, mobile-first, wizard-driven UI + font-size toggle + simple mode
> + high-contrast/reduced-motion. **Do not** build age-specific UIs.
