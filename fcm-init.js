// ════════════════════════════════════════════════
//  fcm-init.js  — Raftaroo Push Notification Setup
//  Dono pages mein include karein:
//    track-live-rider.html   (customer)
//    captain-active-ride.html (captain)
// ════════════════════════════════════════════════

// ⚠️ IMPORTANT: Yeh aap ki VAPID public key hai
// Firebase Console → Project Settings → Cloud Messaging →
// Web Push certificates → Generate key pair → copy karein
const VAPID_PUBLIC_KEY = "BAhTsS4OrHcgOe3REg1F-k-tXrR_6UZWD2euZaY-bemEczD7CefwWjuwopXMgaN39i1ew8Oldo-KJjz2x01wGmI";

/**
 * FCM permission maango aur token Firebase mein save karo
 *
 * @param {object} firebaseApp  - already initialized Firebase app
 * @param {object} db           - getDatabase(app)
 * @param {string} role         - "customer" ya "captain"
 * @param {string} userId       - current user ki Firebase UID
 */
async function initPushNotifications(firebaseApp, db, role, userId) {
  try {
    // 1. Browser support check
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.log("Push notifications is browser mein support nahi.");
      return;
    }

    // 2. Permission maango
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("User ne notification permission deny kar di.");
      return;
    }

    // 3. Service Worker ready hone ka wait karo
    const registration = await navigator.serviceWorker.ready;

    // 4. FCM token lo
    const { getMessaging, getToken } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js"
    );
    const messaging = getMessaging(firebaseApp);

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("FCM token nahi mila.");
      return;
    }

    // 5. Token Firebase DB mein save karo
    const { ref, set } = await import(
      "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js"
    );

    if (role === "customer") {
      await set(ref(db, `users/${userId}/fcmToken`), token);
    } else if (role === "captain") {
      await set(ref(db, `riders/${userId}/fcmToken`), token);
    }

    console.log(`✅ FCM token saved for ${role}: ${token.substring(0, 20)}...`);

    // 6. Token refresh handle karo
    const { onMessage } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js"
    );

    // Foreground notification (jab app open ho)
    onMessage(messaging, (payload) => {
      console.log("[fcm-init] Foreground message:", payload);
      // Jab app open ho toh in-app chat already update ho jaata hai Firebase listener se
      // Sirf ek soft sound/vibration karo
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    });

  } catch (err) {
    console.error("Push notification setup failed:", err);
  }
}

// Export for use in HTML files
window.initPushNotifications = initPushNotifications;