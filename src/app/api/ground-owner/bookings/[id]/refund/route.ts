import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notify";
import { reviewableFacilityIds } from "@/lib/payment-review";

// POST /api/ground-owner/bookings/[id]/refund — { reference?, note? }
// The ground holds the player's transfer, so the owner (or worker) refunds it and marks it done here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const { note, reference } = await req.json().catch(() => ({}));
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) || null : null;
    // The website asks for the bank transfer reference; older app builds only send a note
    const ref       = typeof reference === "string" ? reference.trim().slice(0, 100) : "";
    const stored    = [ref && `Ref: ${ref}`, cleanNote].filter(Boolean).join(" — ") || null;

    const facilityIds = await reviewableFacilityIds(session.user);
    const booking = await db.facilityBooking.findFirst({
      where:   { id, facilityId: { in: facilityIds } },
      include: { user: { select: { id: true } }, facility: { select: { name: true } } },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    const updated = await db.facilityBooking.updateMany({
      where: { id, refundStatus: "NEEDED" },
      data:  { refundStatus: "PROCESSED", paymentStatus: "REFUNDED", refundNote: stored, refundProcessedAt: new Date() },
    });
    if (updated.count === 0) return Response.json({ error: "This booking does not have a pending refund." }, { status: 400 });

    const amount = booking.refundAmount ?? booking.totalAmount;
    await createNotification({
      userId:  booking.user.id,
      title:   "Refund sent",
      message: `${booking.facility.name} says it refunded Rs. ${amount.toLocaleString()} for your cancelled booking.${ref ? ` Reference: ${ref}.` : ""}${cleanNote ? ` Note: ${cleanNote}` : ""} If it hasn't arrived within 3 working days, tell GoPlay from your booking.`,
      type:    "success",
      link:    `/my-bookings/${booking.id}/pay`,
    });
    return Response.json({ message: "Refund marked as sent." });
  } catch (err) {
    console.error("[POST /api/ground-owner/bookings/[id]/refund]", err);
    return Response.json({ error: "Failed to update refund." }, { status: 500 });
  }
}
