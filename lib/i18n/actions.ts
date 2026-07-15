"use server";

import { cookies } from "next/headers";
import { getClinicConfig } from "@/config/clinic";

/**
 * Persist the user's chosen language in a cookie. The request config
 * (i18n/request.ts) reads NEXT_LOCALE on the next render. The client calls
 * router.refresh() afterwards to re-render with the new locale.
 *
 * Rejects languages the clinic hasn't enabled (defense-in-depth — request.ts
 * re-validates on read too, but there's no point persisting a useless cookie).
 */
export async function setLocale(locale: string) {
  if (!getClinicConfig().locale.languages.includes(locale)) return;

  const store = await cookies();
  store.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
}
