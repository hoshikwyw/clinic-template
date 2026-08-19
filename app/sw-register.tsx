"use client";

import { useEffect } from "react";

/** Registers the service worker (enables PWA install). No-op if unsupported. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration failures are non-fatal
      });
    }
  }, []);
  return null;
}
