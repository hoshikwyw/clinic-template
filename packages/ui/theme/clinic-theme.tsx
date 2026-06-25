"use client";

import * as React from "react";
import type { Branding } from "@config-engine/schema";

/**
 * ClinicThemeProvider — maps a clinic's branding onto design tokens.
 *
 * Per-clinic branding = swap token values, never touch components. We set the
 * CSS custom properties on a wrapping element so the theme is scoped to its
 * subtree (multi-tenant friendly).
 *
 * See docs/04-ui-ux-system.md ("Theming / branding").
 */
export function brandingToStyle(branding: Branding): React.CSSProperties {
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
    ...(vars as React.CSSProperties),
    ...(branding.font ? { fontFamily: branding.font } : {}),
  };
}

export function ClinicThemeProvider({
  branding,
  className,
  children,
}: {
  branding: Branding;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-clinic-theme className={className} style={brandingToStyle(branding)}>
      {children}
    </div>
  );
}
