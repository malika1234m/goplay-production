import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { sendBookingConfirmedEmail, sendBookingCancelledEmail } from "@/lib/email";
import { getCommissionRate } from "@/lib/settings";
import { STRIKE_SUSPEND_THRESHOLD, STRIKE_RESET_DAYS } from "@/lib/cancellation-policy";

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
        facility: {
          select: {
            name:              true,
            cancelStrikeCount: true,
            strikeResetAt:     true,
            isListingSuspended: true,
          },
        },
        user: { select: { id: true, name: true, email: true } },
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

    // Owner cancellation: apply strike system + full refund
    if (status === "CANCELLED") {
      const now      = new Date();
      const facility = booking.facility;

      // Reset strike window if 90 days have passed
      const resetDue = facility.strikeResetAt
        ? (now.getTime() - facility.strikeResetAt.getTime()) / 86_400_000 >= STRIKE_RESET_DAYS
        : true;
      const currentStrikes = resetDue ? 0 : facility.cancelStrikeCount;
      const newStrikes     = currentStrikes + 1;
      const suspend        = newStrikes >= STRIKE_SUSPEND_THRESHOLD;

      await db.sportsFacility.update({
        where: { id: booking.facilityId },
        data: {
          cancelStrikeCount:  newStrikes,
          strikeResetAt:      resetDue ? now : undefined,
          isListingSuspended: suspend ? true : undefined,
        },
      });

      // Store cancellation info + always 100% refund to player
      const isOnlinePaid = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID";
      await db.facilityBooking.update({
        where: { id },
        data: {
          cancelledAt:   now,
          cancelledBy:   "owner",
          refundPercent: 100,
          refundAmount:  booking.totalAmount,
          ...(isOnlinePaid ? { refundStatus: "NEEDED" } : {}),
        },
      });

      const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });

      const adminMessages: { title: string; message: string; type: "error" | "warning" | "info" | "success" }[] = [];
      if (isOnlinePaid) {
        adminMessages.push({
          title:   "Refund Required",
          message: `Owner of ${booking.facility.name} cancelled a paid booking by ${booking.user.name} on ${dateStr}. Full refund: Rs. ${booking.totalAmount.toLocaleString()}.`,
          type:    "error" as const,
        });
      }
      if (suspend) {
        adminMessages.push({
          title:   "Facility Suspended — Strike Limit Reached",
          message: `${booking.facility.name} has reached ${newStrikes} cancellation strikes in 90 days and has been automatically suspended.`,
          type:    "error" as const,
        });
      } else {
        adminMessages.push({
          title:   "Owner Cancellation Strike",
          message: `${booking.facility.name} cancelled a booking (strike ${newStrikes}/${STRIKE_SUSPEND_THRESHOLD}). ${STRIKE_SUSPEND_THRESHOLD - newStrikes} more will suspend the listing.`,
          type:    "warning" as const,
        });
      }

      await db.notification.createMany({
        data: admins.flatMap((a) =>
          adminMessages.map((msg) => ({ userId: a.id, ...msg }))
        ),
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
