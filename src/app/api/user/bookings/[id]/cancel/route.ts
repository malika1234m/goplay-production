import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendBookingCancelledEmail } from "@/lib/email";
import {
  getCancellationPolicyFromTiers,
  loadPolicyTiers,
  CASH_CANCEL_BAN_THRESHOLD,
  NO_SHOW_ONLINE_THRESHOLD,
  NO_SHOW_SUSPEND_THRESHOLD,
} from "@/lib/cancellation-policy";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const booking = await db.facilityBooking.findUnique({
      where: { id },
      include: {
        facility: {
          select: {
            name:  true,
            owner: { select: { user: { select: { id: true } } } },
          },
        },
        user: {
          select: {
            cashCancelCount:    true,
            noShowCount:        true,
            isBookingSuspended: true,
          },
        },
      },
    });

    if (!booking)                          return Response.json({ error: "Booking not found." }, { status: 404 });
    if (booking.userId !== session.user.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    if (booking.status === "CANCELLED")    return Response.json({ error: "Booking is already cancelled." }, { status: 400 });
    if (booking.status === "COMPLETED")    return Response.json({ error: "Cannot cancel a completed booking." }, { status: 400 });
    if (booking.status === "NO_SHOW")      return Response.json({ error: "Cannot cancel a no-show booking." }, { status: 400 });
    if (booking.user.isBookingSuspended)   return Response.json({ error: "Your account is suspended. Please contact support." }, { status: 403 });

    const tiers        = await loadPolicyTiers();
    const policy       = getCancellationPolicyFromTiers(booking.bookingDate, booking.startTime, tiers);
    const isOnlinePaid = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID";
    const refundAmount = isOnlinePaid
      ? Math.round(booking.totalAmount * policy.refundPercent) / 100
      : 0;
    const needsRefund  = isOnlinePaid && policy.refundPercent > 0;

    const now = new Date();

    await db.facilityBooking.update({
      where: { id },
      data: {
        status:        "CANCELLED",
        cancelledAt:   now,
        cancelledBy:   "user",
        refundPercent: policy.refundPercent,
        refundAmount,
        ...(needsRefund ? { refundStatus: "NEEDED" } : {}),
      },
    });

    // Track cash cancellations on user
    if (booking.paymentMethod === "ON_ARRIVAL") {
      const newCashCount = booking.user.cashCancelCount + 1;
      await db.user.update({
        where: { id: booking.userId },
        data:  { cashCancelCount: newCashCount,
          ...(newCashCount >= CASH_CANCEL_BAN_THRESHOLD ? { isBookingSuspended: true } : {}),
        },
      });
    }

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

    const refundNote = isOnlinePaid
      ? policy.refundPercent > 0
        ? `You will receive a ${policy.refundPercent}% refund (Rs. ${refundAmount.toLocaleString()}). Our team will process it shortly.`
        : "No refund applies for cancellations within 4 hours of the booking."
      : "";

    await db.notification.create({
      data: {
        userId:  session.user.id,
        title:   "Booking Cancelled",
        message: `Your booking at ${booking.facility.name} on ${dateStr} has been cancelled.${refundNote ? " " + refundNote : ""}`,
        type:    "warning",
      },
    });

    await db.notification.create({
      data: {
        userId:  booking.facility.owner.user.id,
        title:   "Booking Cancelled by Player",
        message: `A player cancelled their booking at ${booking.facility.name} on ${dateStr} (${booking.startTime}–${booking.endTime}). The slot is now free.`,
        type:    "warning",
      },
    });

    if (needsRefund) {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          title:   "Refund Required",
          message: `${session.user.name ?? "A player"} cancelled their paid booking at ${booking.facility.name} on ${dateStr}. Refund: Rs. ${refundAmount.toLocaleString()} (${policy.refundPercent}% of Rs. ${booking.totalAmount.toLocaleString()}).`,
          type:    "error" as const,
        })),
      });
    }

    void sendBookingCancelledEmail({
      to:           session.user.email ?? "",
      name:         session.user.name  ?? "Player",
      facilityName: booking.facility.name,
      date:         dateStr,
      startTime:    booking.startTime,
      endTime:      booking.endTime,
      cancelledBy:  "player",
      refundNeeded: needsRefund,
    });

    return Response.json({
      message:       "Booking cancelled successfully.",
      refundPercent: policy.refundPercent,
      refundAmount,
    });
  } catch (err) {
    console.error("[PUT /api/user/bookings/:id/cancel]", err);
    return Response.json({ error: "Failed to cancel booking." }, { status: 500 });
  }
}
