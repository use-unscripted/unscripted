/* Unscripted service worker.
 *
 * This exists for one reason: an installed home screen app has to start fast on
 * a phone, and a signed-in student on campus wifi should not re-download the
 * same JavaScript bundle every launch.
 *
 * It is deliberately the smallest thing that does that, because the failure mode
 * of a service worker is serving people a stale build for weeks with no way to
 * tell them. So the rules are narrow and there is nothing clever here:
 *
 *   1. HTML is always network-first. The document is never read from a cache, so
 *      a published build reaches every phone on the next launch, same as the web.
 *   2. Only build output under /assets/ is cached, and only when the filename
 *      carries Vite's content hash. A hashed name cannot go stale by definition:
 *      change the file and the name changes with it, so the old entry is simply
 *      never asked for again.
 *   3. Everything else falls straight through to the network untouched. API
 *      calls, the Base44 SDK, auth, entity reads, anything with a student's data
 *      in it: not cached, not inspected, not stored. There is no code path here
 *      that can put a logged-in response on disk.
 *
 * Anything beyond that (offline pages, cached data, background sync) needs a
 * real decision about staleness first. Don't extend this file casually.
 */

const CACHE = 'unscripted-assets-v1';

// Vite writes build output as name-<hash>.ext. The hash is what makes the entry
// safe to keep forever, so the pattern requires one rather than matching the
// directory alone.
const HASHED_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

self.addEventListener('install', () => {
  // No precache list. Nothing is worth storing before it has been asked for.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload lets the browser start fetching the document in
      // parallel with the worker booting, which is most of the reason a
      // network-first document handler costs nothing.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('unscripted-') && n !== CACHE).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// A way out. If this worker ever has to be pulled, a build can post this and the
// worker removes itself and its cache rather than needing every student to clear
// their browser by hand.
self.addEventListener('message', (event) => {
  if (event.data === 'unregister') {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n.startsWith('unscripted-')).map((n) => caches.delete(n)));
        await self.registration.unregister();
      })()
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Documents: always the network. The preloaded response if there is one,
  // otherwise a plain fetch. Nothing is written to a cache on this path.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const preloaded = await event.preloadResponse;
        return preloaded || fetch(request);
      })()
    );
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Same origin only, hashed build output only. Everything else, including every
  // API and SDK call, is left alone and goes to the network as normal.
  if (url.origin !== self.location.origin) return;
  if (!HASHED_ASSET.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;

      const response = await fetch(request);
      // Only a clean same-origin 200 is worth keeping. Opaque and error
      // responses get used once and forgotten.
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
