const { onValueCreated } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// ─── TRIGGER: Naya message aate hi notification bhejo ───
exports.sendChatNotification = onValueCreated(
  {
    ref: "/requests/{requestId}/messages/{messageId}",
    region: "asia-southeast1", // Apne Firebase DB region ke mutabiq rakhein
  },
  async (event) => {
    const message = event.data.val();
    const { requestId } = event.params;

    if (!message || !message.text || !message.sender) return null;

    const db = getDatabase();

    // Ride request ka data lo
    const requestSnap = await db.ref(`requests/${requestId}`).get();
    const request = requestSnap.val();
    if (!request) return null;

    const sender = message.sender;
    const msgText = message.text;

    // System messages pe notification nahi
    if (sender === "system") return null;

    let recipientToken = null;
    let notifTitle = "";
    let notifBody = msgText.length > 80 ? msgText.substring(0, 80) + "..." : msgText;
    let clickUrl = "";

    if (sender === "captain") {
      // Captain → Customer ko notify karo
      const captainName = request.riderName || "Aap ka Captain";
      notifTitle = `🏍️ ${captainName}`;
      clickUrl = `/track-live-rider.html?bookingId=${requestId}`;

      const snap = await db.ref(`users/${request.customerId}/fcmToken`).get();
      recipientToken = snap.val();

    } else if (sender === "customer") {
      // Customer → Captain ko notify karo
      const customerName = request.customerName || "Customer";
      notifTitle = `👤 ${customerName}`;
      clickUrl = `/captain-active-ride.html?rideId=${requestId}`;

      const snap = await db.ref(`riders/${request.riderId}/fcmToken`).get();
      recipientToken = snap.val();
    }

    if (!recipientToken) {
      console.log(`No FCM token | sender: ${sender} | requestId: ${requestId}`);
      return null;
    }

    const payload = {
      token: recipientToken,
      notification: {
        title: notifTitle,
        body: notifBody,
      },
      data: {
        requestId,
        sender,
        type: "chat_message",
        url: clickUrl,
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "raftaroo_chat",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "/android-192.png",
          badge: "/favicon-32.png",
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
        fcmOptions: { link: clickUrl },
      },
    };

    try {
      const res = await getMessaging().send(payload);
      console.log(`✅ Sent: ${res}`);
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
      // Invalid token → Firebase se hata do
      if (
        err.code === "messaging/invalid-registration-token" ||
        err.code === "messaging/registration-token-not-registered"
      ) {
        if (sender === "captain") {
          await db.ref(`users/${request.customerId}/fcmToken`).remove();
        } else {
          await db.ref(`riders/${request.riderId}/fcmToken`).remove();
        }
      }
    }

    return null;
  }
);