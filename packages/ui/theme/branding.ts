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
  if (branding.primaryForeground) {
    // Text/icons that sit on the primary color — critical for legibility when
    // primaryColor is light.
    vars["--primary-foreground"] = branding.primaryForeground;
    vars["--sidebar-primary-foreground"] = branding.primaryForeground;
  }
  if (branding.accentColor) {
    vars["--accent"] = branding.accentColor;
  }
  if (branding.secondaryColor) {
    vars["--secondary"] = branding.secondaryColor;
  }
  if (branding.radius) {
    vars["--radius"] = branding.radius;
  }

  // Escape hatch: arbitrary token overrides win over everything above. Keys may
  // be given with or without the leading `--`.
  if (branding.tokens) {
    for (const [key, value] of Object.entries(branding.tokens)) {
      vars[key.startsWith("--") ? key : `--${key}`] = value;
    }
  }

  return {
    ...(vars as CSSProperties),
    ...(branding.font ? { fontFamily: branding.font } : {}),
  };
}
