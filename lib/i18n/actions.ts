"use server";

import { cookies } from "next/headers";

/**
 * Persist the user's chosen language in a cookie. The request config
 * (i18n/request.ts) reads NEXT_LOCALE on the next render. The client calls
 * router.refresh() afterwards to re-render with the new locale.
 */
export async function setLocale(locale: string) {
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
}
