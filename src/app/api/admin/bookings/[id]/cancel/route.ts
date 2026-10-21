import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { sendBookingCancelledEmail } from "@/lib/email";

// POST /api/admin/bookings/:id/cancel  { reason } — GoPlay cancels a booking (a dispute, a fake
// booking, a ground that can't host it). Frees the slot, and tells the player and the ground why.
// No strike for either side: this is GoPlay's decision. Players pay grounds directly, so a paid
// booking is flagged for the ground to refund and followed up on the Refunds page.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (reason.length < 5) return Response.json({ error: "Give the reason (at least 5 characters). The player and the ground will see it." }, { status: 400 });

  const b = await db.facilityBooking.findUnique({
    where:   { id },
    include: { user: { select: { id: true, name: true, email: true } }, facility: { select: { name: true, owner: { select: { userId: true } } } } },
  });
  if (!b) return Response.json({ error: "Booking not found." }, { status: 404 });
  if (b.isOpenMatch) return Response.json({ error: "This booking belongs to an open match. Cancel the lobby from Open Matches instead." }, { status: 400 });

  const paid = b.paymentMethod === "ONLINE" && ["PAID", "RECEIPT_SUBMITTED"].includes(b.paymentStatus);
  // Only a booking that still holds a slot can be cancelled; the status check makes a double click harmless
  const done = await db.facilityBooking.updateMany({
    where: { id, status: { in: ["PENDING", "CONFIRMED"] } },
    data:  {
      status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "admin",
      refundNote: `Cancelled by GoPlay: ${reason}`,
      ...(paid ? { refundStatus: "NEEDED", refundPercent: 100, refundAmount: b.totalAmount } : {}),
    },
  });
  if (done.count === 0) return Response.json({ error: `This booking is already ${b.status.toLowerCase().replace("_", "-")} and can't be cancelled.` }, { status: 409 });

  const when = `${b.bookingDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} ${b.startTime}`;
  await Promise.all([
    createNotification({
      userId:  b.userId,
      title:   "Booking cancelled by GoPlay",
      message: `Your booking at ${b.facility.name} on ${when} was cancelled: ${reason}${paid ? " The ground will refund your transfer in full." : ""}`,
      type:    "warning",
    }),
    createNotification({
      userId:  b.facility.owner.userId,
      title:   "Booking cancelled by GoPlay",
      message: `GoPlay cancelled ${b.user.name}'s booking on ${when}: ${reason}. The slot is free again.${paid ? ` Please refund Rs. ${Math.round(b.totalAmount).toLocaleString()} to the player.` : ""}`,
      type:    "warning",
      link:    "/ground-owner/bookings",
    }),
  ]);
  void sendBookingCancelledEmail({
    to: b.contactEmail ?? b.user.email, name: b.user.name, facilityName: b.facility.name,
    date: when.split(" ").slice(0, 3).join(" "), startTime: b.startTime, endTime: b.endTime,
    cancelledBy: "admin", reason, refundNeeded: paid,
  });

  return Response.json({ ok: true, refundNeeded: paid, message: paid ? "Booking cancelled. The ground has been asked to refund the player." : "Booking cancelled." });
}
