"use client";

import { useEffect } from "react";

/**
 * Keeps the dark class in sync with the OS theme while in "system" mode
 * (no explicit `theme` in localStorage). Explicit light/dark choices are
 * untouched. Initial paint is handled by the root layout's PREFS_INIT script.
 */
export function ThemeListener() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      try {
        if (!localStorage.getItem("theme")) {
          document.documentElement.classList.toggle("dark", mq.matches);
        }
      } catch {}
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return null;
}
