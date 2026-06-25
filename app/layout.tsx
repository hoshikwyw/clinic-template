import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getClinicConfig } from "@/config/clinic";
import { brandingToStyle } from "@ui/theme/branding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = getClinicConfig();
  return {
    title: {
      default: config.branding.name,
      template: `%s · ${config.branding.name}`,
    },
    description: `Book an appointment at ${config.branding.name}.`,
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

// Applies saved accessibility prefs before paint, so there's no flash.
const A11Y_INIT = `(function(){try{var d=document.documentElement.dataset;var f=localStorage.getItem('a11y-font');if(f)d.fontScale=f;if(localStorage.getItem('a11y-contrast')==='high')d.contrast='high';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = getClinicConfig();

  return (
    <html
      lang={config.locale.defaultLang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col"
        style={brandingToStyle(config.branding)}
      >
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT }} />
        {children}
      </body>
    </html>
  );
}
