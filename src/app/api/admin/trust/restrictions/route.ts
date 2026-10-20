import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { forbidden, requireAdmin } from "@/lib/admin-guard";
import { createNotification } from "@/lib/notify";

// POST /api/admin/trust/restrictions — { userId } — give a player another chance: lift the
// "pay online only" and booking suspension (their history stays on record)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return forbidden();
    const { userId } = await req.json().catch(() => ({}));
    const user = await db.user.findFirst({ where: { id: String(userId ?? ""), role: "USER", isActive: true }, select: { id: true } });
    if (!user) return Response.json({ error: "Active player not found (unblock them first if blocked)." }, { status: 404 });
    await db.user.update({ where: { id: user.id }, data: { requiresOnlinePayment: false, isBookingSuspended: false } });
    await createNotification({ userId: user.id, title: "Booking restrictions lifted", message: "GoPlay has lifted the restrictions on your account. Please turn up for the slots you book, or cancel in time.", type: "success" });
    return Response.json({ message: "Restrictions lifted." });
  } catch (err) {
    console.error("[POST /api/admin/trust/restrictions]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
