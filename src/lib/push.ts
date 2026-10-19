import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

/**
 * Send one push and read Expo's ticket. A token Expo says is no longer registered (app
 * uninstalled, or a stale token) is cleared so we stop sending to it. Never throws —
 * push failures must not break the API response.
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) return;

  const message: ExpoPushMessage = {
    to:        pushToken,
    sound:     "default",
    channelId: "default",
    priority:  "high",
    title,
    body,
    data,
  };

  try {
    for (const chunk of expo.chunkPushNotifications([message])) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "ok") continue;
        if (ticket.details?.error === "DeviceNotRegistered") {
          const { db } = await import("@/lib/db");
          await db.user.updateMany({ where: { pushToken }, data: { pushToken: null } });
        } else {
          // e.g. InvalidCredentials when the FCM key isn't uploaded to EAS
          console.error("[push]", ticket.details?.error ?? "", ticket.message);
        }
      }
    }
  } catch (err) {
    console.error("[push] send failed", err);
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
  if (user?.pushToken) {
    await sendPushNotification(user.pushToken, title, body, data);
  }
}
