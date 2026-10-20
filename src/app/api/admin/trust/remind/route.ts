import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { forbidden, requireAdmin } from "@/lib/admin-guard";
import { createNotification } from "@/lib/notify";

// POST /api/admin/trust/remind — { facilityId, count } — ask a ground to settle cash bookings it never marked
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return forbidden();
    const { facilityId, count } = await req.json().catch(() => ({}));
    const f = await db.sportsFacility.findUnique({ where: { id: String(facilityId ?? "") }, select: { name: true, owner: { select: { userId: true } } } });
    if (!f) return Response.json({ error: "Ground not found." }, { status: 404 });
    const n = Number(count) || 0;
    await createNotification({
      userId:  f.owner.userId,
      title:   "Please update past bookings",
      message: `${n > 0 ? `${n} cash booking${n > 1 ? "s" : ""} at ${f.name}` : `Some cash bookings at ${f.name}`} ended but were never marked completed or no-show. Please update them so your records and commission are correct.`,
      type:    "warning",
      link:    "/ground-owner/bookings",
    });
    return Response.json({ message: "Reminder sent to the ground." });
  } catch (err) {
    console.error("[POST /api/admin/trust/remind]", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
