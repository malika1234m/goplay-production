import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

interface NotifyInput {
  userId:  string;
  title:   string;
  message: string;
  type?:   string;
  link?:   string;
}

export async function createNotification(input: NotifyInput): Promise<void> {
  const { userId, title, message, type = "info", link } = input;

  await db.notification.create({
    data: { userId, title, message, type, link },
  });

  // Fire push notification without awaiting so the API response is never delayed
  void sendPushToUser(userId, title, message, link ? { link } : undefined);
}
