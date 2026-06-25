"use client";

import * as React from "react";
import { Contrast } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessibility toolbar — text size (A / A+ / A++) and high-contrast toggle.
 *
 * Sets data-font-scale / data-contrast on <html> (the CSS tokens live in
 * globals.css) and persists to localStorage. The no-FOUC init script in the
 * root layout applies saved values before paint. For ALL ages — see
 * docs/04-ui-ux-system.md.
 */
type Scale = "base" | "lg" | "xl";

const SIZES: { value: Scale; label: string; title: string }[] = [
  { value: "base", label: "A", title: "Normal text size" },
  { value: "lg", label: "A+", title: "Large text size" },
  { value: "xl", label: "A++", title: "Extra-large text size" },
];

export function AccessibilityToolbar({ className }: { className?: string }) {
  const [scale, setScale] = React.useState<Scale>("base");
  const [contrast, setContrast] = React.useState(false);

  // Sync UI state with whatever the init script already applied.
  React.useEffect(() => {
    const d = document.documentElement.dataset;
    setScale((d.fontScale as Scale) || "base");
    setContrast(d.contrast === "high");
  }, []);

  function applyScale(s: Scale) {
    const root = document.documentElement;
    if (s === "base") delete root.dataset.fontScale;
    else root.dataset.fontScale = s;
    try {
      if (s === "base") localStorage.removeItem("a11y-font");
      else localStorage.setItem("a11y-font", s);
    } catch {}
    setScale(s);
  }

  function toggleContrast() {
    const root = document.documentElement;
    const next = !contrast;
    if (next) root.dataset.contrast = "high";
    else delete root.dataset.contrast;
    try {
      if (next) localStorage.setItem("a11y-contrast", "high");
      else localStorage.removeItem("a11y-contrast");
    } catch {}
    setContrast(next);
  }

  const btn = (active: boolean) =>
    cn(
      "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border hover:bg-muted"
    );

  return (
    <div
      role="group"
      aria-label="Accessibility options"
      className={cn("flex items-center gap-1", className)}
    >
      <span className="sr-only">Text size</span>
      {SIZES.map((s) => (
        <button
          key={s.value}
          type="button"
          title={s.title}
          aria-pressed={scale === s.value}
          onClick={() => applyScale(s.value)}
          className={btn(scale === s.value)}
        >
          {s.label}
        </button>
      ))}
      <button
        type="button"
        title="High contrast"
        aria-pressed={contrast}
        onClick={toggleContrast}
        className={cn(btn(contrast), "ml-1")}
      >
        <Contrast className="size-4" aria-hidden />
        <span className="sr-only">High contrast</span>
      </button>
    </div>
  );
}
