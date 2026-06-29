"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Sun, Moon, Monitor } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";

/** Native display labels for each language (autonyms). */
const LANGUAGE_LABELS: Record<string, string> = { en: "EN", my: "မြန်မာ" };

type Scale = "base" | "lg" | "xl";
const SIZES: { value: Scale; label: string }[] = [
  { value: "base", label: "A" },
  { value: "lg", label: "A+" },
  { value: "xl", label: "A++" },
];

type Theme = "light" | "dark" | "system";
const THEMES: { value: Theme; labelKey: string; Icon: typeof Sun }[] = [
  { value: "light", labelKey: "themeLight", Icon: Sun },
  { value: "dark", labelKey: "themeDark", Icon: Moon },
  { value: "system", labelKey: "themeSystem", Icon: Monitor },
];

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Settings panel — language, text size, and high-contrast controls, rendered
 * inline on the Settings page (not a dropdown).
 *
 * Accessibility prefs set data-font-scale / data-contrast on <html> + persist to
 * localStorage (applied before paint by the root layout's init script). Language
 * persists via cookie (lib/i18n/actions). See docs/04-ui-ux-system.md and
 * docs/08-i18n-languages.md.
 */
export function SettingsPanel({ languages }: { languages: string[] }) {
  const t = useTranslations("settings");
  const activeLocale = useLocale();
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [scale, setScale] = React.useState<Scale>("base");
  const [contrast, setContrast] = React.useState(false);
  const [theme, setTheme] = React.useState<Theme>("system");

  // Reflect whatever the no-FOUC init script already applied.
  React.useEffect(() => {
    const d = document.documentElement.dataset;
    setScale((d.fontScale as Scale) || "base");
    setContrast(d.contrast === "high");
    try {
      setTheme((localStorage.getItem("theme") as Theme) || "system");
    } catch {}
  }, []);

  function applyTheme(value: Theme) {
    const root = document.documentElement;
    try {
      if (value === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", value);
    } catch {}
    const dark = value === "dark" || (value === "system" && prefersDark());
    root.classList.toggle("dark", dark);
    setTheme(value);
  }

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

  function changeLanguage(l: string) {
    if (l === activeLocale) return;
    startTransition(async () => {
      await setLocale(l);
      router.refresh();
    });
  }

  const showLanguage = languages.length > 1;

  return (
    <div className="max-w-md space-y-6">
      {showLanguage && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">{t("language")}</h2>
          <div className="flex gap-2">
            {languages.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => changeLanguage(l)}
                aria-pressed={l === activeLocale}
                className={cn(
                  "min-h-11 flex-1 rounded-lg border text-sm",
                  l === activeLocale
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                )}
              >
                {LANGUAGE_LABELS[l] ?? l.toUpperCase()}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">{t("theme")}</h2>
        <div className="flex gap-2">
          {THEMES.map(({ value, labelKey, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => applyTheme(value)}
              aria-pressed={theme === value}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium",
                theme === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">{t("textSize")}</h2>
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => applyScale(s.value)}
              aria-pressed={scale === s.value}
              className={cn(
                "min-h-11 flex-1 rounded-lg border font-medium",
                scale === s.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t("highContrast")}</h2>
        <button
          type="button"
          role="switch"
          aria-checked={contrast}
          aria-label={t("highContrast")}
          onClick={toggleContrast}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            contrast ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white transition-transform",
              contrast ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </section>
    </div>
  );
}
