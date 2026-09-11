// App-shell service worker. Deliberately does NOT touch beste.schule/api
// requests — those must always hit the network so a student never sees
// stale or cross-account grade data (docs/plan.md §6). Same-origin static
// assets are cached at runtime (network-first, cache fallback) so the shell
// still loads offline; there's no fixed precache list to keep in sync by hand.
const CACHE_NAME = "schulblick-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept beste.schule (or anything else cross-origin)

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
  );
});
