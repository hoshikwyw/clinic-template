import type { MetadataRoute } from "next";
import { getClinicConfig } from "@/config/clinic";

/**
 * Web app manifest — makes the patient app installable ("Add to Home Screen").
 * Built from the clinic config so each clinic's install gets its own name/icon.
 * Served at /manifest.webmanifest; Next links it into the document automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  const config = getClinicConfig();
  return {
    name: config.branding.name,
    short_name: config.branding.shortName ?? config.branding.name,
    description: `Book an appointment at ${config.branding.name}.`,
    start_url: "/portal",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: config.locale.defaultLang,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
