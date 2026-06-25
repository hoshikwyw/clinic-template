/**
 * ui — the design system (shadcn-based, mobile-first, WCAG 2.1 AA).
 *
 *   primitives/ — buttons, inputs (shadcn components we OWN)
 *   patterns/   — booking wizard, cards, lists
 *   shell/      — adaptive nav: bottom-bar on mobile <-> sidebar on desktop
 *
 * All color/spacing/typography/radius come from design tokens, so per-clinic
 * branding = swap token values, never touch components.
 *
 * See docs/04-ui-ux-system.md.
 */

export { Button, buttonVariants } from "./primitives/button";
