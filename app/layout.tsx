import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Myanmar } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { getClinicConfig } from "@/config/clinic";
import { brandingToStyle } from "@ui/theme/branding";
import { ServiceWorkerRegister } from "./sw-register";
import { ThemeListener } from "./theme-listener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Myanmar (Burmese) Unicode coverage — used as a font-stack fallback so Burmese
// text renders correctly on every device. See docs/08-i18n-languages.md.
const notoMyanmar = Noto_Sans_Myanmar({
  variable: "--font-myanmar",
  subsets: ["myanmar"],
  weight: ["400", "500", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = getClinicConfig();
  return {
    title: {
      default: config.branding.name,
      template: `%s · ${config.branding.name}`,
    },
    description: `Book an appointment at ${config.branding.name}.`,
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
  };
}

// viewport-fit=cover lets safe-area-inset-* work under notches / home bars (mobile + Capacitor)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Applies saved prefs (text size, contrast, dark theme) before paint — no flash.
const PREFS_INIT = `(function(){try{var el=document.documentElement,d=el.dataset;var f=localStorage.getItem('a11y-font');if(f)d.fontScale=f;if(localStorage.getItem('a11y-contrast')==='high')d.contrast='high';var th=localStorage.getItem('theme');if(th==='dark'||(!th&&matchMedia('(prefers-color-scheme: dark)').matches))el.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = getClinicConfig();
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      // The PREFS_INIT script sets the dark class + data-* on <html> before
      // hydration; suppress the expected server/client attribute mismatch on
      // this element (the documented escape hatch for pre-paint theming).
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoMyanmar.variable} h-full scroll-smooth antialiased`}
    >
      <body
        className="flex min-h-full flex-col"
        style={brandingToStyle(config.branding)}
      >
        <script dangerouslySetInnerHTML={{ __html: PREFS_INIT }} />
        <ServiceWorkerRegister />
        <ThemeListener />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
