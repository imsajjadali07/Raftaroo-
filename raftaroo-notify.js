/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   raftaroo-notify.js  — Server-less Push Notifications      ║
 * ║   Firebase Cloud Functions ke baghair kaam karta hai        ║
 * ║   SW postMessage system use karta hai                       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Kaise kaam karta hai:
 *   1. Firebase DB listener → change detect karo
 *   2. SW ko postMessage bhejo (SHOW_NOTIFICATION)
 *   3. SW notification dikhata hai — screen off ho tab bhi
 *
 * Har page pe include karein (</body> se pehle):
 *   <script src="/raftaroo-notify.js"></script>
 */

(function () {
  'use strict';

  // ── Permission request ───────────────────────────────────────
  async function ensurePermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  // ── SW ko notification command bhejo ────────────────────────
  async function sendToSW(title, body, url, notifType, tag) {
    try {
      const granted = await ensurePermission();
      if (!granted) {
        console.warn('[RaftarooNotify] Permission nahi mili');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) {
        console.warn('[RaftarooNotify] SW active nahi hai');
        return false;
      }

      reg.active.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: { title, body, url, notifType, tag }
      });
      return true;
    } catch (err) {
      console.error('[RaftarooNotify] Error:', err.message);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════════

  /**
   * Captain ke liye — naya ride request aaya
   * captain-dashboard.html pe call karo jab Firebase mein
   * naya pending request mile
   */
  window.RaftarooNotify = {

    // Captain ko ride request notification
    rideRequest: (fare, distance, customerName, requestId) =>
      sendToSW(
        '🏍️ Naya Ride Request!',
        `Rs. ${fare} • ${distance} km • ${customerName}`,
        `/captain-dashboard.html`,
        'ride_request',
        `ride-req-${requestId}`
      ),

    // Passenger ko — captain ne offer accept kiya
    offerAccepted: (captainName, fare, requestId) =>
      sendToSW(
        '✅ Captain Mil Gaya!',
        `${captainName} aap ki ride accept kar raha hai — Rs. ${fare}`,
        `/track-live-rider.html?bookingId=${requestId}`,
        'ride_matched',
        `offer-acc-${requestId}`
      ),

    // Passenger ko — captain ne counter offer bheja
    counterOffer: (captainName, newFare, requestId) =>
      sendToSW(
        '💬 Captain Ka Counter Offer',
        `${captainName} ne Rs. ${newFare} ka offer bheja — Accept karein?`,
        `/index.html`,
        'offer_counter',
        `counter-${requestId}`
      ),

    // Captain ko — passenger ne offer accept kiya
    passengerAccepted: (customerName, requestId) =>
      sendToSW(
        '🎉 Offer Accept Ho Gayi!',
        `${customerName} ne aap ki offer maan li — Ride shuru karein!`,
        `/captain-active-ride.html?rideId=${requestId}`,
        'offer_accepted',
        `pass-acc-${requestId}`
      ),

    // Captain ko — ride cancel ho gayi
    rideCancelled: (reason) =>
      sendToSW(
        '❌ Ride Cancel Ho Gayi',
        reason || 'Customer ne ride cancel kar di',
        `/captain-dashboard.html`,
        'ride_cancelled',
        `cancelled-${Date.now()}`
      ),

    // Passenger ko — captain aa raha hai
    captainArriving: (captainName, eta, requestId) =>
      sendToSW(
        '📍 Captain Aa Raha Hai!',
        `${captainName} — ${eta} minute mein pohonchega`,
        `/track-live-rider.html?bookingId=${requestId}`,
        'captain_arriving',
        `arriving-${requestId}`
      ),

    // Passenger ko — ride complete
    rideComplete: (fare, requestId) =>
      sendToSW(
        '🏁 Ride Complete!',
        `Rs. ${fare} — Please rating dein`,
        `/track-live-rider.html?bookingId=${requestId}`,
        'ride_complete',
        `complete-${requestId}`
      ),

    // Chat message
    chatMessage: (senderName, message, url) =>
      sendToSW(
        `💬 ${senderName}`,
        message.length > 80 ? message.substring(0, 80) + '...' : message,
        url,
        'chat_message',
        `chat-${Date.now()}`
      ),

    // General / custom
    custom: (title, body, url, tag) =>
      sendToSW(title, body, url || '/', 'general', tag || `custom-${Date.now()}`),

    // Permission manually request karo
    requestPermission: ensurePermission,
  };

  console.log('[RaftarooNotify] ✅ Loaded — Server-less notification system ready');
})();
