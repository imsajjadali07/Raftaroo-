// ════════════════════════════════════════════════
//  Raftaroo Service Worker  — sw.js
//  PWA caching + FCM background notifications
// ════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ─── Firebase config (same as your app) ───
firebase.initializeApp({
  apiKey: "AIzaSyBBS7jGzuVlTIIeN9VFBxpwHkNf-mIRzDo",
  authDomain: "raftaroo-9ce8d.firebaseapp.com",
  databaseURL: "https://raftaroo-9ce8d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "raftaroo-9ce8d",
  storageBucket: "raftaroo-9ce8d.firebasestorage.app",
  messagingSenderId: "773738074182",
  appId: "1:773738074182:web:b7a873959c7ab8edc0ba47",
  measurementId: "G-EM1R4LGZTD"
});

const messaging = firebase.messaging();

// ─── Background message handler ───
// Jab app close ho ya background mein ho tab yeh kaam karta hai
messaging.onBackgroundMessage((payload) => {
  console.log("[sw.js] Background message:", payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  const options = {
    body: body || "Naya message hai",
    icon: "/android-192.png",
    badge: "/favicon-32.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "Kholein" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: false,
    tag: "raftaroo-chat-" + (data.requestId || Date.now()),
    renotify: true,
  };

  self.registration.showNotification(title || "Raftaroo", options);
});

// ─── Notification click handler ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Agar app already open hai toh wahi focus karo
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // Warna naya tab kholo
        return clients.openWindow(url);
      })
  );
});

// ════════════════════════════════════════════════
//  PWA Cache (optional but recommended)
// ════════════════════════════════════════════════
const CACHE_NAME = "raftaroo-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/track-live-rider.html",
  "/captain-active-ride.html",
  "/android-192.png",
  "/android-512.png",
  "/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});