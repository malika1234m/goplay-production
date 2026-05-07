import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// PATCH /api/notifications/:id — mark one notification as read
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const notification = await db.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== session.user.id) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    await db.notification.update({ where: { id }, data: { isRead: true } });

    return Response.json({ message: "Marked as read." });
  } catch (err) {
    console.error("[PATCH /api/notifications/:id]", err);
    return Response.json({ error: "Failed to update notification." }, { status: 500 });
  }
}

// DELETE /api/notifications/:id — delete one notification
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const notification = await db.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== session.user.id) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    await db.notification.delete({ where: { id } });

    return Response.json({ message: "Notification deleted." });
  } catch (err) {
    console.error("[DELETE /api/notifications/:id]", err);
    return Response.json({ error: "Failed to delete notification." }, { status: 500 });
  }
}
