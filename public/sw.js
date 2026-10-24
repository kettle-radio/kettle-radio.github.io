// Minimal helper so phones treat the site as installable. It doesn't cache anything:
// every visit still loads the latest page.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
