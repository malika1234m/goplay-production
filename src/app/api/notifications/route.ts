import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/notifications?limit=10&page=1&unread=true
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit  = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
    const page   = Math.max(Number(searchParams.get("page")  ?? "1"), 1);
    const unread = searchParams.get("unread") === "true";

    const where = {
      userId: session.user.id,
      ...(unread ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take:    limit,
        skip:    (page - 1) * limit,
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: session.user.id, isRead: false } }),
    ]);

    return Response.json({ notifications, total, unreadCount, page, limit });
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return Response.json({ error: "Failed to fetch notifications." }, { status: 500 });
  }
}

// DELETE /api/notifications  — clear all read notifications
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { count } = await db.notification.deleteMany({
      where: { userId: session.user.id, isRead: true },
    });

    return Response.json({ message: `Cleared ${count} notification${count !== 1 ? "s" : ""}.`, count });
  } catch (err) {
    console.error("[DELETE /api/notifications]", err);
    return Response.json({ error: "Failed to clear notifications." }, { status: 500 });
  }
}
