"use client";

import * as React from "react";
import type { Branding } from "@config-engine/schema";
import { brandingToStyle } from "./branding";

/**
 * ClinicThemeProvider — scopes a clinic's branding tokens to a subtree.
 * (Branding is applied globally in the root layout; this is for scoped overrides.)
 * See docs/04-ui-ux-system.md ("Theming / branding").
 */
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
