import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notify";
import { reviewableFacilityIds } from "@/lib/payment-review";

// POST /api/ground-owner/bookings/[id]/refund — { note? }
// The ground holds the player's transfer, so the owner (or worker) refunds it and marks it done here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const { note } = await req.json().catch(() => ({}));
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) || null : null;

    const facilityIds = await reviewableFacilityIds(session.user);
    const booking = await db.facilityBooking.findFirst({
      where:   { id, facilityId: { in: facilityIds } },
      include: { user: { select: { id: true } }, facility: { select: { name: true } } },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    const updated = await db.facilityBooking.updateMany({
      where: { id, refundStatus: "NEEDED" },
      data:  { refundStatus: "PROCESSED", paymentStatus: "REFUNDED", refundNote: cleanNote, refundProcessedAt: new Date() },
    });
    if (updated.count === 0) return Response.json({ error: "This booking does not have a pending refund." }, { status: 400 });

    const amount = booking.refundAmount ?? booking.totalAmount;
    await createNotification({
      userId:  booking.user.id,
      title:   "Refund sent",
      message: `${booking.facility.name} has refunded Rs. ${amount.toLocaleString()} for your cancelled booking.${cleanNote ? ` Note: ${cleanNote}` : ""} If it hasn't arrived within 3 working days, contact GoPlay support.`,
      type:    "success",
    });
    return Response.json({ message: "Refund marked as sent." });
  } catch (err) {
    console.error("[POST /api/ground-owner/bookings/[id]/refund]", err);
    return Response.json({ error: "Failed to update refund." }, { status: 500 });
  }
}
