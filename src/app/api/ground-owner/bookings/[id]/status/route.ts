import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { sendBookingConfirmedEmail, sendBookingCancelledEmail } from "@/lib/email";
import { getCommissionRate } from "@/lib/settings";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const actor = await db.user.findUnique({ where: { id: session.user.id }, select: { isActive: true } });
    if (!actor?.isActive) {
      return Response.json({ error: "Your account has been deactivated. Please contact support." }, { status: 403 });
    }

    const { id } = await params;
    const { status, cashReceived } = await req.json();

    const allowed = ["CONFIRMED", "CANCELLED", "COMPLETED"];
    if (!allowed.includes(status)) {
      return Response.json({ error: `Status must be one of: ${allowed.join(", ")}` }, { status: 400 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const facilityIds = profile.facilities.map((f) => f.id);

    const booking = await db.facilityBooking.findFirst({
      where: { id, facilityId: { in: facilityIds } },
      include: {
        facility: { select: { name: true } },
        user:     { select: { id: true, name: true, email: true } },
      },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    // Guard: state transition rules
    if (booking.status === "COMPLETED") {
      return Response.json({ error: "This booking is already completed and cannot be changed." }, { status: 400 });
    }
    if (booking.status === "CANCELLED" && status === "COMPLETED") {
      return Response.json({ error: "Cannot complete a cancelled booking." }, { status: 400 });
    }

    // Guard: cannot mark complete before the session has ended
    if (status === "COMPLETED") {
      const [h, m]     = booking.endTime.split(":").map(Number);
      const sessionEnd = new Date(booking.bookingDate);
      sessionEnd.setHours(h, m, 0, 0);
      if (sessionEnd > new Date()) {
        return Response.json({ error: "Cannot mark a booking complete before the session has ended." }, { status: 400 });
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = { status };

    if (status === "COMPLETED" && booking.paymentMethod === "ON_ARRIVAL") {
      // Ground owner explicitly confirmed cash: update payment status
      updateData.paymentStatus = cashReceived ? "PAID" : "PENDING";
    }

    const updated = await db.facilityBooking.update({
      where: { id },
      data: updateData,
    });

    // Create earnings record when marking complete (one-time, idempotent via bookingId unique)
    if (status === "COMPLETED") {
      const existingEarning = await db.groundEarning.findUnique({ where: { bookingId: id } });

      if (!existingEarning) {
        const isWalkIn   = booking.specialRequests?.startsWith("[Walk-in]") ?? false;
        const PLATFORM_FEE_PCT = await getCommissionRate();
        const gross      = booking.totalAmount;
        const fee        = isWalkIn ? 0 : Math.round(gross * PLATFORM_FEE_PCT * 100) / 100;
        const net        = isWalkIn ? gross : Math.round((gross - fee) * 100) / 100;
        const isOnline   = booking.paymentMethod === "ONLINE";
        const confirmed  = isOnline ? booking.paymentStatus === "PAID" : (cashReceived === true);

        await db.groundEarning.create({
          data: {
            bookingId:      id,
            facilityId:     booking.facilityId,
            ownerId:        profile.id,
            grossAmount:    gross,
            platformFee:    fee,
            netAmount:      net,
            paymentMethod:  booking.paymentMethod,
            cashConfirmed:  confirmed,
            ...(isWalkIn && { commissionNote: "Walk-in — no platform commission" }),
          },
        });
      }
    }

    // If owner cancelled a paid online booking, flag it for refund
    if (status === "CANCELLED" && booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID") {
      await db.facilityBooking.update({
        where: { id },
        data:  { refundStatus: "NEEDED" },
      });
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          title:   "Refund Required",
          message: `The owner of ${booking.facility.name} cancelled a paid online booking by ${booking.user.name} on ${dateStr}. Rs. ${booking.totalAmount.toLocaleString()} needs to be refunded to the player.`,
          type:    "error" as const,
        })),
      });
    }

    // Notify user
    const messages: Record<string, string> = {
      CONFIRMED: `Your booking at ${booking.facility.name} has been confirmed!`,
      CANCELLED: booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID"
        ? `Your booking at ${booking.facility.name} has been cancelled by the owner. Your payment will be refunded — our team will be in touch.`
        : `Your booking at ${booking.facility.name} has been cancelled by the owner.`,
      COMPLETED: `Your session at ${booking.facility.name} is marked as completed. Thanks for playing!`,
    };

    await db.notification.create({
      data: {
        userId:  booking.userId,
        title:   `Booking ${status.charAt(0) + status.slice(1).toLowerCase()}`,
        message: messages[status],
        type:    status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "warning" : "info",
      },
    });

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

    // Email for CONFIRMED and CANCELLED (fire-and-forget)
    if (status === "CONFIRMED") {
      void sendBookingConfirmedEmail({
        to:            booking.user.email ?? "",
        name:          booking.user.name  ?? "Player",
        facilityName:  booking.facility.name,
        date:          dateStr,
        startTime:     booking.startTime,
        endTime:       booking.endTime,
        totalAmount:   booking.totalAmount,
        paymentMethod: booking.paymentMethod,
        bookingId:     booking.id,
      });
    } else if (status === "CANCELLED") {
      void sendBookingCancelledEmail({
        to:           booking.user.email ?? "",
        name:         booking.user.name  ?? "Player",
        facilityName: booking.facility.name,
        date:         dateStr,
        startTime:    booking.startTime,
        endTime:      booking.endTime,
        cancelledBy:  "owner",
        refundNeeded: booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID",
      });
    }

    if (booking.contactNumber) {
      const smsMessages: Record<string, string> = {
        CONFIRMED: `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} from ${booking.startTime} to ${booking.endTime} has been confirmed. See you there!`,
        CANCELLED: `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} was cancelled by the owner. Contact support if needed.`,
        COMPLETED: `GoPlay: Your session at ${booking.facility.name} on ${dateStr} is complete. Thanks for playing!`,
      };
      if (smsMessages[status]) await sendSMS(booking.contactNumber, smsMessages[status]);
    }

    return Response.json({ booking: updated, message: `Booking marked as ${status}.` });
  } catch (err) {
    console.error("[PUT /api/ground-owner/bookings/:id/status]", err);
    return Response.json({ error: "Failed to update booking status." }, { status: 500 });
  }
}
