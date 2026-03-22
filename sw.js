// ── Meal Planner Service Worker ──────────────────────────────────────────────
// Version: bump this string to force all clients to update
const CACHE_VERSION = 'meal-planner-v3';

// Files to cache on install — app shell only
// meals.json is fetched and cached at runtime
const SHELL_FILES = [
  '/meal-planner/',
  '/meal-planner/index.html',
  '/meal-planner/family.html',
  '/meal-planner/css/design-system.css',
  '/meal-planner/js/meals.js',
  '/meal-planner/js/storage.js',
  '/meal-planner/js/picks-url.js',
  '/meal-planner/js/sync.js',
  '/meal-planner/manifest.json',
  '/meal-planner/icon-180.png',
  '/meal-planner/icon-192.png',
];

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for shell, network-first for data ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // meals.json — network first, fall back to cache
  if (url.pathname.includes('meals.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else — cache first, fall back to network
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
      )
  );
});
