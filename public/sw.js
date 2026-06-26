// Minimal service worker — required for PWA installability.
// Network pass-through for now (no caching), so there's no staleness risk.
// Extend with a caching strategy later for offline support.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: let the network handle every request. The presence of this
  // handler + the web manifest is what makes the app installable.
});
