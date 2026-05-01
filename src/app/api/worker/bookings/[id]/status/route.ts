import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { getCommissionRate } from "@/lib/settings";

async function getWorkerFacilityId(userId: string): Promise<string | null> {
  const w = await db.facilityWorker.findUnique({ where: { userId } });
  return w?.facilityId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_WORKER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { status, cashReceived } = await req.json();

    if (!["CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) {
      return Response.json({ error: `Status must be one of: CONFIRMED, COMPLETED, CANCELLED` }, { status: 400 });
    }

    const facilityId = await getWorkerFacilityId(session.user.id);
    if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

    const booking = await db.facilityBooking.findFirst({
      where: { id, facilityId },
      include: {
        facility: {
          select: {
            name:  true,
            owner: { include: { user: { select: { id: true } } } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    if (booking.status === "COMPLETED") {
      return Response.json({ error: "This booking is already completed and cannot be changed." }, { status: 400 });
    }
    if (booking.status === "CANCELLED") {
      return Response.json({ error: "Cannot update a cancelled booking." }, { status: 400 });
    }

    if (status === "COMPLETED") {
      const [h, m]     = booking.endTime.split(":").map(Number);
      const sessionEnd = new Date(booking.bookingDate);
      sessionEnd.setHours(h, m, 0, 0);
      if (sessionEnd > new Date()) {
        return Response.json({ error: "Cannot mark complete before the session has ended." }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "COMPLETED" && booking.paymentMethod === "ON_ARRIVAL") {
      updateData.paymentStatus = cashReceived ? "PAID" : "PENDING";
    }

    const updated = await db.facilityBooking.update({ where: { id }, data: updateData });

    // Earnings record on completion (idempotent)
    if (status === "COMPLETED") {
      const existingEarning = await db.groundEarning.findUnique({ where: { bookingId: id } });
      if (!existingEarning) {
        const profile = await db.groundOwnerProfile.findUnique({
          where: { userId: booking.facility.owner.user.id },
        });
        if (profile) {
          const isWalkIn = booking.specialRequests?.startsWith("[Walk-in]") ?? false;
          const PLATFORM_FEE_PCT = await getCommissionRate();
          const gross    = booking.totalAmount;
          const fee      = isWalkIn ? 0 : Math.round(gross * PLATFORM_FEE_PCT * 100) / 100;
          const net      = isWalkIn ? gross : Math.round((gross - fee) * 100) / 100;
          const isOnline = booking.paymentMethod === "ONLINE";

          await db.groundEarning.create({
            data: {
              bookingId:     id,
              facilityId:    booking.facilityId,
              ownerId:       profile.id,
              grossAmount:   gross,
              platformFee:   fee,
              netAmount:     net,
              paymentMethod: booking.paymentMethod,
              cashConfirmed: isOnline ? booking.paymentStatus === "PAID" : (cashReceived === true),
              ...(isWalkIn && { commissionNote: "Walk-in — no platform commission" }),
            },
          });
        }
      }
    }

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

    // If a paid online booking is cancelled → flag for refund and alert admins
    if (status === "CANCELLED" && booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID") {
      await db.facilityBooking.update({ where: { id }, data: { refundStatus: "NEEDED" } });
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          title:   "Refund Required",
          message: `A worker (${session.user.name ?? "unknown"}) cancelled a paid online booking by ${booking.user.name} at ${booking.facility.name} on ${dateStr}. Rs. ${booking.totalAmount.toLocaleString()} needs to be refunded.`,
          type:    "error" as const,
        })),
      });
    }

    // Notify player
    const cancelMsg = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID"
      ? `Your booking at ${booking.facility.name} has been cancelled. Your payment will be refunded — our team will be in touch.`
      : `Your booking at ${booking.facility.name} has been cancelled.`;

    const messages: Record<string, string> = {
      CONFIRMED: `Your booking at ${booking.facility.name} has been confirmed!`,
      COMPLETED: `Your session at ${booking.facility.name} is marked as completed. Thanks for playing!`,
      CANCELLED: cancelMsg,
    };
    await db.notification.create({
      data: {
        userId:  booking.user.id,
        title:   `Booking ${status.charAt(0) + status.slice(1).toLowerCase()}`,
        message: messages[status],
        type:    status === "CONFIRMED" ? "success" : status === "CANCELLED" ? "warning" : "info",
      },
    });

    // SMS
    if (booking.contactNumber) {
      const smsMap: Record<string, string> = {
        CONFIRMED: `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} from ${booking.startTime} to ${booking.endTime} has been confirmed. See you there!`,
        COMPLETED: `GoPlay: Your session at ${booking.facility.name} on ${dateStr} is complete. Thanks for playing!`,
        CANCELLED: `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} was cancelled. Contact support if needed.`,
      };
      if (smsMap[status]) await sendSMS(booking.contactNumber, smsMap[status]);
    }

    // Notify owner
    await db.notification.create({
      data: {
        userId:  booking.facility.owner.user.id,
        title:   `Booking ${status.charAt(0) + status.slice(1).toLowerCase()} by Worker`,
        message: `${session.user.name ?? "A worker"} marked the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}) as ${status.toLowerCase()}.`,
        type:    status === "CANCELLED" ? "warning" : "info",
      },
    });

    return Response.json({ booking: updated, message: `Booking marked as ${status}.` });
  } catch (err) {
    console.error("[PUT /api/worker/bookings/:id/status]", err);
    return Response.json({ error: "Failed to update booking status." }, { status: 500 });
  }
}
