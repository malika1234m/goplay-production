import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { isActive } = await req.json();

    if (typeof isActive !== "boolean") {
      return Response.json({ error: "isActive must be a boolean." }, { status: 400 });
    }

    // Prevent admin from deactivating themselves
    if (id === session.user.id) {
      return Response.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return Response.json({ error: "User not found." }, { status: 404 });

    // Prevent deactivating other admins
    if (target.role === "ADMIN") {
      return Response.json({ error: "Admin accounts cannot be deactivated." }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id },
      data:  { isActive },
      select: { id: true, isActive: true },
    });

    return Response.json({ user: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]/status]", err);
    return Response.json({ error: "Failed to update user status." }, { status: 500 });
  }
}
