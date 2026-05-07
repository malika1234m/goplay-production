import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// PUT /api/notifications/read-all — mark all notifications as read
export async function PUT() {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { count } = await db.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data:  { isRead: true },
    });

    return Response.json({ message: `Marked ${count} notification${count !== 1 ? "s" : ""} as read.`, count });
  } catch (err) {
    console.error("[PUT /api/notifications/read-all]", err);
    return Response.json({ error: "Failed to mark notifications as read." }, { status: 500 });
  }
}
