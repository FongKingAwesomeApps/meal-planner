// ── Meal Planner Service Worker v4 ───────────────────────────────────────────
// Network-first for HTML and CSS (always fresh), cache-first for assets
// Version string — change this to force all clients to update
const VERSION = 'mp-v6';

// Files that must be available offline
const STATIC = [
  '/meal-planner/icon-180.png',
  '/meal-planner/icon-192.png',
  '/meal-planner/data/meals.json',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// ── Activate — delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET, non-same-origin, and chrome-extension requests
  if (e.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname !== self.location.hostname && 
      !url.hostname.endsWith('workers.dev') &&
      !url.hostname.endsWith('googleapis.com')) return;

  // Skip API calls — always network
  if (url.hostname.endsWith('workers.dev')) return;
  if (url.hostname.endsWith('anthropic.com')) return;

  // HTML and CSS — network first, fall back to cache
  const ext = url.pathname.split('.').pop();
  if (['html','css','js'].includes(ext) || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else (images, JSON) — cache first, network fallback
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
          return res;
        })
      )
  );
});

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', e => {
  // Handle empty push (no payload) or payload
  let data = { title: 'Meal Planner 🍽', body: 'Tap to check your picks' };
  if (e.data) {
    try { data = e.data.json(); } catch { data = { title: 'Meal Planner 🍽', body: e.data.text() }; }
  }

  e.waitUntil(
    self.registration.showNotification(data.title || 'Meal Planner', {
      body:  data.body  || '',
      icon:  data.icon  || '/meal-planner/icon-192.png',
      badge: '/meal-planner/icon-192.png',
      data:  { url: data.url || '/meal-planner/' },
      vibrate: [100, 50, 100],
    })
  );
});

// ── Notification click — open the app ────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/meal-planner/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes('meal-planner') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
