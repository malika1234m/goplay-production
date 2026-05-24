import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) return;

  const message: ExpoPushMessage = {
    to:    pushToken,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch {
    // Never throw — push failures must not break the API response
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
