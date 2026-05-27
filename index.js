const { onValueCreated, onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

// ─────────────────────────────────────────────────────────────
//  TRIGGER 1: Chat message notification (existing)
// ─────────────────────────────────────────────────────────────
exports.sendChatNotification = onValueCreated(
  {
    ref: "/requests/{requestId}/messages/{messageId}",
    region: "asia-southeast1",
  },
  async (event) => {
    const message = event.data.val();
    const { requestId } = event.params;

    if (!message || !message.text || !message.sender) return null;

    const db = getDatabase();
    const requestSnap = await db.ref(`requests/${requestId}`).get();
    const request = requestSnap.val();
    if (!request) return null;

    const sender = message.sender;
    const msgText = message.text;

    if (sender === "system") return null;

    let recipientToken = null;
    let notifTitle = "";
    let notifBody = msgText.length > 80 ? msgText.substring(0, 80) + "..." : msgText;
    let clickUrl = "";

    if (sender === "captain") {
      const captainName = request.riderName || "Aap ka Captain";
      notifTitle = `🏍️ ${captainName}`;
      clickUrl = `/track-live-rider.html?bookingId=${requestId}`;
      const snap = await db.ref(`users/${request.customerId}/fcmToken`).get();
      recipientToken = snap.val();
    } else if (sender === "customer") {
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
      notification: { title: notifTitle, body: notifBody },
      data: { requestId, sender, type: "chat_message", url: clickUrl },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "raftaroo_chat",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
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
      console.log(`✅ Chat notification sent: ${res}`);
    } catch (err) {
      console.error(`❌ Chat notification failed: ${err.message}`);
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

// ─────────────────────────────────────────────────────────────
//  TRIGGER 2: Admin broadcast notification
//  Admin panel se /admin_notifications/{id} mein naya record
//  aata hai → yeh function saare tokens ko notification bhejta hai
// ─────────────────────────────────────────────────────────────
exports.sendAdminBroadcast = onValueCreated(
  {
    ref: "/admin_notifications/{notifId}",
    region: "asia-southeast1",
  },
  async (event) => {
    const notif = event.data.val();
    const { notifId } = event.params;

    if (!notif || notif.status !== "queued") return null;
    if (!notif.title || !notif.body) return null;

    const db = getDatabase();

    // Status update: processing
    await db.ref(`admin_notifications/${notifId}/status`).set("processing");

    const tokens = notif.tokens || [];
    if (tokens.length === 0) {
      await db.ref(`admin_notifications/${notifId}/status`).set("no_tokens");
      return null;
    }

    console.log(`📢 Broadcasting to ${tokens.length} tokens | Type: ${notif.type}`);

    const clickUrl = notif.url || "/";
    const iconMap = {
      promo:   "/android-192.png",
      general: "/android-192.png",
      alert:   "/android-192.png",
      update:  "/android-192.png",
      eid:     "/android-192.png",
    };

    // FCM multicast — max 500 tokens per batch
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failCount = 0;
    const invalidTokens = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);

      const multicastMsg = {
        tokens: batch,
        notification: {
          title: notif.title,
          body:  notif.body,
        },
        data: {
          type:    notif.type || "general",
          url:     clickUrl,
          notifId: notifId,
        },
        android: {
          priority: "high",
          notification: {
            sound:     "default",
            channelId: "raftaroo_broadcast",
            icon:      "ic_notification",
            color:     "#00C853",
          },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
        webpush: {
          headers: { Urgency: "high" },
          notification: {
            icon:              iconMap[notif.type] || "/android-192.png",
            badge:             "/favicon-32.png",
            vibrate:           [200, 100, 200],
            requireInteraction: false,
            tag:               `raftaroo-admin-${notif.type}`,
          },
          fcmOptions: { link: clickUrl },
        },
      };

      try {
        const response = await getMessaging().sendEachForMulticast(multicastMsg);
        successCount += response.successCount;
        failCount    += response.failureCount;

        // Invalid tokens collect karo cleanup ke liye
        response.responses.forEach((r, idx) => {
          if (!r.success) {
            const errCode = r.error?.code;
            if (
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(batch[idx]);
            }
          }
        });

        console.log(`Batch ${Math.floor(i/BATCH_SIZE)+1}: ✅${response.successCount} ❌${response.failureCount}`);
      } catch (err) {
        console.error(`Batch error:`, err.message);
        failCount += batch.length;
      }
    }

    // Invalid tokens DB se hataao (background cleanup)
    if (invalidTokens.length > 0) {
      console.log(`🧹 Removing ${invalidTokens.length} invalid tokens...`);
      await cleanupInvalidTokens(db, invalidTokens);
    }

    // Final status update
    await db.ref(`admin_notifications/${notifId}`).update({
      status:       "sent",
      successCount,
      failCount,
      processedAt:  Date.now(),
    });

    console.log(`✅ Broadcast done! Sent: ${successCount} | Failed: ${failCount}`);
    return null;
  }
);

// ─────────────────────────────────────────────────────────────
//  HELPER: Invalid tokens ko users/riders se remove karo
// ─────────────────────────────────────────────────────────────
async function cleanupInvalidTokens(db, invalidTokens) {
  const tokenSet = new Set(invalidTokens);

  const [usersSnap, ridersSnap] = await Promise.all([
    db.ref("users").get(),
    db.ref("riders").get(),
  ]);

  const cleanupPromises = [];

  if (usersSnap.exists()) {
    usersSnap.forEach((child) => {
      if (tokenSet.has(child.val().fcmToken)) {
        cleanupPromises.push(db.ref(`users/${child.key}/fcmToken`).remove());
      }
    });
  }

  if (ridersSnap.exists()) {
    ridersSnap.forEach((child) => {
      if (tokenSet.has(child.val().fcmToken)) {
        cleanupPromises.push(db.ref(`riders/${child.key}/fcmToken`).remove());
      }
    });
  }

  await Promise.all(cleanupPromises);
  console.log(`🧹 Cleaned ${cleanupPromises.length} stale tokens`);
}