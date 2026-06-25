# 08 — Internationalization (i18n) & Languages

## Decision

The platform is **multilingual with in-app language switching**. First two
languages, supported from the start:

| Language | Code | Notes |
|---|---|---|
| **English** | `en` | Default fallback locale |
| **Myanmar (Burmese)** | `my` | Full first-class support |

- Library: **next-intl** (already in the stack — see [01](./01-tech-stack.md)).
- Message files live in **`locales/`** (`en.json`, `my.json`).
- A clinic's available languages + default come from **`ClinicConfig.locale`**
  (`languages`, `defaultLang`) — so each clinic can enable/disable languages.
- Users can **switch language in-app** at any time (persisted per user/device).
  This pairs with the font-size and contrast toggles in
  [04 — UI/UX](./04-ui-ux-system.md) as part of the accessibility controls.

## Myanmar-specific gotchas (important — record these now)

1. **Unicode, not Zawgyi.** Myanmar text has two incompatible encodings: the
   standard **Unicode** and the legacy **Zawgyi**. We standardize on **Unicode**
   only. (Optional future nicety: detect/convert Zawgyi input.)
2. **Fonts.** System Burmese font support is inconsistent, especially on older
   Android. **Bundle a Myanmar Unicode webfont** (e.g. Noto Sans Myanmar /
   Padauk) and apply it for the `my` locale so rendering is correct everywhere.
3. **Text expansion / line-height.** Burmese script is taller and wraps
   differently than Latin. Our generous spacing, large touch targets, and
   font-size scale already help; verify layouts in `my` as part of the
   "fits every screen" QA gate.
4. **No complex pluralization**, but date/number/currency formatting still go
   through next-intl's formatters, not hand-built strings.

## What's done now (Phase 0)

- `locales/en.json` and `locales/my.json` seeded with starter keys.
- Decision + caveats recorded here.

## What lands later

- **Phase 1:** wire next-intl provider, locale routing/detection, the in-app
  language switcher, and the bundled Myanmar webfont.
- **Ongoing:** translate every new module's strings into both locales as we build.

> Rule: **no hardcoded user-facing strings.** Every label goes through a
> translation key in `locales/`, so adding a third language later is just a new
> JSON file.
