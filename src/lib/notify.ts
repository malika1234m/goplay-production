import { after } from "next/server";
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

  // Send the push after the response so it never delays it. A bare un-awaited promise can be cut
  // off when a serverless function finishes; after() keeps the invocation alive until it's sent.
  // Outside a request (scripts) after() throws, so the push is simply awaited there.
  const push = () => sendPushToUser(userId, title, message, link ? { link } : undefined);
  try {
    after(push);
  } catch {
    await push();
  }
}
