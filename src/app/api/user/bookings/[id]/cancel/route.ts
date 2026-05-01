import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const booking = await db.facilityBooking.findUnique({
      where: { id },
      include: {
        facility: {
          select: { name: true },
          include: { owner: { include: { user: { select: { id: true } } } } },
        },
      },
    });

    if (!booking) {
      return Response.json({ error: "Booking not found." }, { status: 404 });
    }
    if (booking.userId !== session.user.id) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }
    if (booking.status === "CANCELLED") {
      return Response.json({ error: "Booking is already cancelled." }, { status: 400 });
    }
    if (booking.status === "COMPLETED") {
      return Response.json({ error: "Cannot cancel a completed booking." }, { status: 400 });
    }

    const needsRefund = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID";

    await db.facilityBooking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        ...(needsRefund ? { refundStatus: "NEEDED" } : {}),
      },
    });

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

    // Notify the user
    await db.notification.create({
      data: {
        userId:  session.user.id,
        title:   "Booking Cancelled",
        message: `Your booking at ${booking.facility.name} on ${dateStr} has been cancelled.`,
        type:    "warning",
      },
    });

    // Notify the ground owner
    await db.notification.create({
      data: {
        userId:  booking.facility.owner.user.id,
        title:   "Booking Cancelled by Player",
        message: `A player has cancelled their booking at ${booking.facility.name} on ${dateStr} (${booking.startTime}–${booking.endTime}). The slot is now free.`,
        type:    "warning",
      },
    });

    // If online + paid, notify admins that a refund is needed
    if (needsRefund) {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          title:   "Refund Required",
          message: `${session.user.name ?? "A player"} cancelled their paid online booking at ${booking.facility.name} on ${dateStr}. Rs. ${booking.totalAmount.toLocaleString()} needs to be refunded via PayHere.`,
          type:    "error",
        })),
      });
    }

    return Response.json({ message: "Booking cancelled successfully." });
  } catch (err) {
    console.error("[PUT /api/user/bookings/:id/cancel]", err);
    return Response.json({ error: "Failed to cancel booking." }, { status: 500 });
  }
}
