import type { CSSProperties } from "react";
import type { Branding } from "@config-engine/schema";

/**
 * Map a clinic's branding onto design tokens (pure — safe in server + client).
 * Per-clinic branding = swap token values, never touch components.
 * See docs/04-ui-ux-system.md ("Theming / branding").
 */
export function brandingToStyle(branding: Branding): CSSProperties {
  const vars: Record<string, string> = {
    "--primary": branding.primaryColor,
    "--ring": branding.primaryColor,
    "--sidebar-primary": branding.primaryColor,
  };
  if (branding.accentColor) {
    vars["--accent"] = branding.accentColor;
  }
  if (branding.radius) {
    vars["--radius"] = branding.radius;
  }

  return {
    ...(vars as CSSProperties),
    ...(branding.font ? { fontFamily: branding.font } : {}),
  };
}
