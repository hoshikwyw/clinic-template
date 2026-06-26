import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { getClinicConfig } from "@/config/clinic";

/**
 * next-intl request config (cookie-based locale, no URL routing).
 *
 * The active locale comes from the NEXT_LOCALE cookie, validated against the
 * languages this clinic enables (config.locale.languages). Falls back to the
 * clinic's default language. Messages load from locales/<locale>.json.
 *
 * See docs/08-i18n-languages.md.
 */
export default getRequestConfig(async () => {
  const clinic = getClinicConfig();
  const store = await cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;

  const locale =
    cookieLocale && clinic.locale.languages.includes(cookieLocale)
      ? cookieLocale
      : clinic.locale.defaultLang;

  const messages = (await import(`../locales/${locale}.json`)).default;

  return { locale, messages };
});
