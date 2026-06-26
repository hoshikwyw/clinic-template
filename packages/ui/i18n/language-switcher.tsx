"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";

/** Native display labels for each language (autonyms). */
const LANGUAGE_LABELS: Record<string, string> = {
  en: "EN",
  my: "မြန်မာ",
};

/**
 * In-app language switcher. Renders one button per enabled language and
 * persists the choice via cookie (see lib/i18n/actions). Pairs with the
 * accessibility toolbar (text size / contrast). See docs/08-i18n-languages.md.
 */
export function LanguageSwitcher({ languages }: { languages: string[] }) {
  const active = useLocale();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  // Nothing to switch between.
  if (languages.length < 2) return null;

  function change(locale: string) {
    if (locale === active) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-border p-0.5"
    >
      {languages.map((lang) => {
        const isActive = lang === active;
        return (
          <button
            key={lang}
            type="button"
            disabled={pending}
            aria-pressed={isActive}
            onClick={() => change(lang)}
            className={cn(
              "min-h-8 rounded-full px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LANGUAGE_LABELS[lang] ?? lang.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
