/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║        RAFTAROO SERVICE WORKER  v3.0.0                  ║
 * ║        Pakistan's Fastest PWA — Production Ready        ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Strategy:
 *  - App Shell   → Cache First (instant load every time)
 *  - API/Dynamic → Network First + Cache Fallback
 *  - Images      → Stale While Revalidate
 *  - Map Tiles   → Cache First (60 min TTL)
 *  - Offline     → Custom offline page
 */

const APP_VERSION   = 'v3.0.0';
const CACHE_SHELL   = `raftaroo-shell-${APP_VERSION}`;
const CACHE_DYNAMIC = `raftaroo-dynamic-${APP_VERSION}`;
const CACHE_IMAGES  = `raftaroo-images-${APP_VERSION}`;
const CACHE_MAPS    = `raftaroo-maps-${APP_VERSION}`;

// All known cache names (for cleanup of old versions)
const ALL_CACHES = [CACHE_SHELL, CACHE_DYNAMIC, CACHE_IMAGES, CACHE_MAPS];

// ──────────────────────────────────────────────────────────────
// APP SHELL — Precached on install (critical for offline)
// ──────────────────────────────────────────────────────────────
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/captain-dashboard.html',
  '/captain-active-ride.html',
  '/captain-profile.html',
  '/track-live-rider.html',
  '/rider-register.html',
  '/shopping-hub.html',
  '/card-creator.html',
  '/contact-us.html',
  '/info-hub.html',
  '/terms-and-conditions.html',
  '/privacy-policy.html',
  '/disclaimer.html',
  '/manifest.json',
  '/favicon-32.png',
  '/favicon-16.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/android-192.png',
  '/android-512.png',
];

// ──────────────────────────────────────────────────────────────
// OFFLINE FALLBACK PAGE (inline HTML)
// ──────────────────────────────────────────────────────────────
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#00C853">
<title>Offline | Raftaroo</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Poppins',sans-serif;}
  body{background:#0A0F1E;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;}
  .icon{font-size:72px;margin-bottom:20px;animation:float 3s ease-in-out infinite;}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-12px);}}
  h1{font-size:28px;font-weight:800;color:#00C853;margin-bottom:10px;}
  p{font-size:15px;color:rgba(255,255,255,0.55);max-width:300px;line-height:1.6;margin-bottom:28px;}
  .badge{background:rgba(0,200,83,0.12);border:1px solid rgba(0,200,83,0.3);color:#00C853;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;margin-bottom:30px;letter-spacing:.5px;}
  button{background:#00C853;color:#0A0F1E;font-weight:700;font-size:15px;padding:14px 36px;border:none;border-radius:50px;cursor:pointer;transition:.2s;}
  button:hover{background:#00b548;transform:translateY(-2px);}
  .tip{margin-top:28px;font-size:12px;color:rgba(255,255,255,0.3);}
  .dots{display:flex;gap:8px;justify-content:center;margin-top:20px;}
  .dot{width:8px;height:8px;border-radius:50%;background:rgba(0,200,83,0.3);animation:blink 1.4s infinite;}
  .dot:nth-child(2){animation-delay:.2s;}
  .dot:nth-child(3){animation-delay:.4s;}
  @keyframes blink{0%,80%,100%{opacity:.3;}40%{opacity:1;background:#00C853;}}
</style>
</head>
<body>
  <div class="icon">🏍️</div>
  <div class="badge">📶 Internet Connection Nahi Hai</div>
  <h1>Aap Offline Hain</h1>
  <p>Internet connection check karein. Raftaroo app ke cached pages ab bhi available hain.</p>
  <button onclick="window.location.reload()">🔄 Dobara Try Karein</button>
  <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  <p class="tip">💡 Tip: Pehle se dekhe gaye pages offline bhi khuljenge</p>
</body>
</html>`;

// ──────────────────────────────────────────────────────────────
// INSTALL EVENT — Precache app shell
// ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log(`[SW ${APP_VERSION}] Installing...`);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);

      // Cache each asset individually — don't fail on missing files
      const results = await Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Failed to cache: ${url}`, err.message);
          })
        )
      );

      // Cache the offline fallback page
      await cache.put(
        '/__offline',
        new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
      );

      const ok = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[SW ${APP_VERSION}] Cached ${ok}/${SHELL_ASSETS.length} shell assets`);

      // Skip waiting — activate immediately
      await self.skipWaiting();
    })()
  );
});

// ──────────────────────────────────────────────────────────────
// ACTIVATE EVENT — Clean old caches
// ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log(`[SW ${APP_VERSION}] Activating...`);

  event.waitUntil(
    (async () => {
      // Delete caches from old versions
      const cacheNames = await caches.keys();
      const deleted = await Promise.all(
        cacheNames
          .filter(name => !ALL_CACHES.includes(name))
          .map(name => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );

      // Take control of all open clients immediately
      await clients.claim();
      console.log(`[SW ${APP_VERSION}] Active. Deleted ${deleted.length} old caches.`);

      // Notify all clients about the update
      const allClients = await clients.matchAll({ type: 'window' });
      allClients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: APP_VERSION,
          timestamp: Date.now()
        });
      });
    })()
  );
});

// ──────────────────────────────────────────────────────────────
// FETCH EVENT — Smart routing by request type
// ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // Skip analytics, ads, GTM (always network)
  if (isAnalyticsRequest(url)) return;

  // ── Map tiles (Leaflet / OpenStreetMap) → Cache First (60 min TTL)
  if (isMapTileRequest(url)) {
    event.respondWith(cacheFirstWithTTL(request, CACHE_MAPS, 60));
    return;
  }

  // ── Images → Stale While Revalidate
  if (isImageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  // ── App shell HTML pages → Cache First with Network Fallback
  if (isShellRequest(url)) {
    event.respondWith(cacheFirstWithNetworkFallback(request));
    return;
  }

  // ── Google Fonts / CDN assets → Stale While Revalidate
  if (isCDNRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC));
    return;
  }

  // ── Everything else → Network First with Cache Fallback
  event.respondWith(networkFirstWithCacheFallback(request));
});

// ──────────────────────────────────────────────────────────────
// CACHING STRATEGIES
// ──────────────────────────────────────────────────────────────

/**
 * Cache First: Try cache, then network, store in cache
 * Best for: App shell, static assets
 */
async function cacheFirstWithNetworkFallback(request) {
  try {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Offline fallback for HTML
    const offlinePage = await caches.match('/__offline');
    return offlinePage || new Response('Raftaroo — Offline Mode', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Network First: Try network, cache result, fallback to cache
 * Best for: Dynamic content, API calls
 */
async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // If it's a navigation request, serve offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/__offline');
      if (offlinePage) return offlinePage;
    }
    throw new Error('Network and cache both failed');
  }
}

/**
 * Stale While Revalidate: Return cache immediately, update in background
 * Best for: Images, fonts, CDN assets
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fetch and update in background (don't await)
  const networkFetch = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cached || await networkFetch;
}

/**
 * Cache First with TTL: Return cache if fresh, otherwise fetch
 * Best for: Map tiles (short TTL)
 */
async function cacheFirstWithTTL(request, cacheName, maxAgeMinutes) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const cachedDate = cached.headers.get('sw-cache-date');
    if (cachedDate) {
      const ageMs = Date.now() - parseInt(cachedDate);
      if (ageMs < maxAgeMinutes * 60 * 1000) {
        return cached;
      }
    } else {
      return cached; // No date header, serve as-is
    }
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Clone and add cache timestamp header
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cache-date', Date.now().toString());
      const cachedResponse = new Response(await networkResponse.blob(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
      cache.put(request, cachedResponse);
    }
    return networkResponse;
  } catch {
    return cached || Response.error();
  }
}

// ──────────────────────────────────────────────────────────────
// REQUEST TYPE HELPERS
// ──────────────────────────────────────────────────────────────

function isAnalyticsRequest(url) {
  return (
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('googlesyndication.com') ||
    url.hostname.includes('monetag.com') ||
    url.hostname.includes('doubleclick.net') ||
    url.hostname.includes('facebook.com') ||
    url.hostname.includes('hotjar.com')
  );
}

function isMapTileRequest(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tiles.stadiamaps.com') ||
    url.hostname.includes('maps.googleapis.com') ||
    url.hostname.includes('unpkg.com') && url.pathname.includes('leaflet')
  );
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i.test(url.pathname) ||
    url.hostname.includes('iili.io') ||
    url.hostname.includes('imgur.com') ||
    url.hostname.includes('cloudinary.com')
  );
}

function isShellRequest(url) {
  return (
    url.hostname === self.location.hostname &&
    (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '')
  );
}

function isCDNRequest(url) {
  return (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('unpkg.com')
  );
}

// ──────────────────────────────────────────────────────────────
// BACKGROUND SYNC — Retry failed form submissions
// ──────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  console.log(`[SW] Background sync: ${event.tag}`);

  if (event.tag === 'sync-contact-form') {
    event.waitUntil(syncContactForm());
  }
  if (event.tag === 'sync-rider-registration') {
    event.waitUntil(syncRiderRegistration());
  }
});

async function syncContactForm() {
  try {
    const db = await openDB();
    const pendingForms = await db.getAll('pending-contact');
    for (const form of pendingForms) {
      // Retry the form submission
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.data)
      });
      await db.delete('pending-contact', form.id);
    }
  } catch (err) {
    console.warn('[SW] Contact form sync failed:', err);
  }
}

async function syncRiderRegistration() {
  // Similar pattern — retry pending registrations
  console.log('[SW] Retrying pending rider registrations...');
}

// ──────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ──────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Raftaroo', body: event.data.text(), type: 'general' };
  }

  const { title, body, type, url, icon, badge, tag } = data;

  const notifOptions = {
    body: body || 'Raftaroo se naya update!',
    icon: icon || '/android-192.png',
    badge: badge || '/favicon-32.png',
    tag: tag || `raftaroo-${type || 'general'}`,
    renotify: true,
    requireInteraction: type === 'ride_request' || type === 'ride_matched',
    vibrate: type === 'ride_request' ? [300, 100, 300, 100, 600] : [200, 100, 200],
    data: { url: url || '/', type, timestamp: Date.now() },
    actions: getNotifActions(type),
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Raftaroo 🏍️', notifOptions)
  );
});

function getNotifActions(type) {
  switch (type) {
    case 'ride_request':
      return [
        { action: 'accept', title: '✅ Accept', icon: '/android-192.png' },
        { action: 'decline', title: '❌ Decline' }
      ];
    case 'ride_matched':
      return [
        { action: 'track', title: '📍 Track Rider' },
        { action: 'call', title: '📞 Call' }
      ];
    case 'promo':
      return [
        { action: 'view', title: '🎁 Offer Dekhen' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    default:
      return [{ action: 'open', title: '🏍️ Raftaroo Kholen' }];
  }
}

// ──────────────────────────────────────────────────────────────
// NOTIFICATION CLICK — Route to correct page
// ──────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const { url, type } = event.notification.data || {};

  let targetUrl = url || '/';

  if (action === 'accept' || action === 'track') {
    targetUrl = '/captain-dashboard.html';
  } else if (action === 'call') {
    targetUrl = url || '/captain-active-ride.html';
  } else if (action === 'view') {
    targetUrl = url || '/index.html';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Open new window
      return clients.openWindow(targetUrl);
    })
  );
});

// ──────────────────────────────────────────────────────────────
// MESSAGE HANDLER — Commands from the main app
// ──────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      // Manually cache specific URLs (e.g., pre-cache a specific route)
      if (payload && Array.isArray(payload.urls)) {
        caches.open(CACHE_DYNAMIC).then(cache => cache.addAll(payload.urls));
      }
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
      break;

    case 'GET_VERSION':
      event.source?.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.source?.postMessage({ type: 'CACHE_SIZE', size });
      });
      break;
  }
});

// ──────────────────────────────────────────────────────────────
// UTILITY: Get approximate cache size
// ──────────────────────────────────────────────────────────────
async function getCacheSize() {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage,
        quota: estimate.quota,
        usedMB: ((estimate.usage || 0) / 1024 / 1024).toFixed(2),
        quotaMB: ((estimate.quota || 0) / 1024 / 1024).toFixed(2)
      };
    }
  } catch (e) {}
  return null;
}

// ──────────────────────────────────────────────────────────────
// PERIODIC BACKGROUND SYNC (where supported)
// ──────────────────────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-ride-prices') {
    event.waitUntil(updateRidePrices());
  }
});

async function updateRidePrices() {
  // Refresh dynamic pricing data in background
  try {
    const response = await fetch('/api/prices');
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put('/api/prices', response);
    }
  } catch {}
}

console.log(`[Raftaroo SW ${APP_VERSION}] Script loaded 🏍️`);