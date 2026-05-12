import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { getCommissionRate } from "@/lib/settings";
import {
  STRIKE_SUSPEND_THRESHOLD,
  STRIKE_RESET_DAYS,
  NO_SHOW_ONLINE_THRESHOLD,
  NO_SHOW_SUSPEND_THRESHOLD,
} from "@/lib/cancellation-policy";

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

    if (!["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) {
      return Response.json({ error: "Status must be one of: CONFIRMED, COMPLETED, CANCELLED, NO_SHOW" }, { status: 400 });
    }

    const facilityId = await getWorkerFacilityId(session.user.id);
    if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

    const booking = await db.facilityBooking.findFirst({
      where: { id, facilityId },
      include: {
        facility: {
          select: {
            name:              true,
            cancelStrikeCount: true,
            strikeResetAt:     true,
            isListingSuspended: true,
            owner: { include: { user: { select: { id: true } } } },
          },
        },
        user: {
          select: {
            id:                   true,
            name:                 true,
            noShowCount:          true,
            requiresOnlinePayment: true,
            isBookingSuspended:    true,
          },
        },
      },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    if (booking.status === "COMPLETED") {
      return Response.json({ error: "This booking is already completed and cannot be changed." }, { status: 400 });
    }
    if (booking.status === "CANCELLED") {
      return Response.json({ error: "Cannot update a cancelled booking." }, { status: 400 });
    }
    if (booking.status === "NO_SHOW") {
      return Response.json({ error: "This booking is already marked as no-show." }, { status: 400 });
    }

    if (status === "COMPLETED") {
      const [h, m]     = booking.endTime.split(":").map(Number);
      const sessionEnd = new Date(booking.bookingDate);
      sessionEnd.setHours(h, m, 0, 0);
      if (sessionEnd > new Date()) {
        return Response.json({ error: "Cannot mark complete before the session has ended." }, { status: 400 });
      }
    }

    if (status === "NO_SHOW") {
      if (booking.status !== "CONFIRMED") {
        return Response.json({ error: "Only confirmed bookings can be marked as no-show." }, { status: 400 });
      }
      const [h, m]      = booking.startTime.split(":").map(Number);
      const slotStart   = new Date(booking.bookingDate);
      slotStart.setHours(h, m, 0, 0);
      if (slotStart > new Date()) {
        return Response.json({ error: "Cannot mark no-show before the session has started." }, { status: 400 });
      }
    }

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    const workerName = session.user.name ?? "A worker";
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    const ownerId = booking.facility.owner.user.id;

    // ── COMPLETED ─────────────────────────────────────────────────────────────
    if (status === "COMPLETED") {
      const updateData: Record<string, unknown> = { status };
      if (booking.paymentMethod === "ON_ARRIVAL") {
        updateData.paymentStatus = cashReceived ? "PAID" : "PENDING";
      }
      const updated = await db.facilityBooking.update({ where: { id }, data: updateData });

      const existingEarning = await db.groundEarning.findUnique({ where: { bookingId: id } });
      if (!existingEarning) {
        const profile = await db.groundOwnerProfile.findUnique({ where: { userId: ownerId } });
        if (profile) {
          const isWalkIn       = booking.specialRequests?.startsWith("[Walk-in]") ?? false;
          const PLATFORM_FEE_PCT = await getCommissionRate();
          const gross          = booking.totalAmount;
          const fee            = isWalkIn ? 0 : Math.round(gross * PLATFORM_FEE_PCT * 100) / 100;
          const net            = isWalkIn ? gross : Math.round((gross - fee) * 100) / 100;
          await db.groundEarning.create({
            data: {
              bookingId:     id,
              facilityId:    booking.facilityId,
              ownerId:       profile.id,
              grossAmount:   gross,
              platformFee:   fee,
              netAmount:     net,
              paymentMethod: booking.paymentMethod,
              cashConfirmed: booking.paymentMethod === "ONLINE"
                ? booking.paymentStatus === "PAID"
                : (cashReceived === true),
              ...(isWalkIn && { commissionNote: "Walk-in — no platform commission" }),
            },
          });
        }
      }

      await db.notification.createMany({
        data: [
          {
            userId:  booking.user.id,
            title:   "Booking Completed",
            message: `Your session at ${booking.facility.name} is marked as completed. Thanks for playing!`,
            type:    "info" as const,
          },
          {
            userId:  ownerId,
            title:   "Booking Completed by Worker",
            message: `${workerName} marked the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}) as completed.`,
            type:    "info" as const,
          },
        ],
      });

      if (booking.contactNumber) {
        await sendSMS(booking.contactNumber, `GoPlay: Your session at ${booking.facility.name} on ${dateStr} is complete. Thanks for playing!`);
      }

      return Response.json({ booking: updated, message: "Booking marked as completed." });
    }

    // ── CONFIRMED ─────────────────────────────────────────────────────────────
    if (status === "CONFIRMED") {
      const updated = await db.facilityBooking.update({ where: { id }, data: { status } });
      await db.notification.createMany({
        data: [
          {
            userId:  booking.user.id,
            title:   "Booking Confirmed",
            message: `Your booking at ${booking.facility.name} has been confirmed!`,
            type:    "success" as const,
          },
          {
            userId:  ownerId,
            title:   "Booking Confirmed by Worker",
            message: `${workerName} confirmed the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}).`,
            type:    "info" as const,
          },
        ],
      });
      if (booking.contactNumber) {
        await sendSMS(booking.contactNumber, `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} from ${booking.startTime} to ${booking.endTime} has been confirmed. See you there!`);
      }
      return Response.json({ booking: updated, message: "Booking confirmed." });
    }

    // ── CANCELLED — strike goes on the facility ────────────────────────────
    if (status === "CANCELLED") {
      const fac = booking.facility;
      const isOnlinePaid = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID";

      // 90-day strike reset
      let currentStrikes = fac.cancelStrikeCount;
      if (fac.strikeResetAt) {
        const daysSince = (Date.now() - fac.strikeResetAt.getTime()) / 86_400_000;
        if (daysSince >= STRIKE_RESET_DAYS) currentStrikes = 0;
      }
      const newStrikes = currentStrikes + 1;
      const suspend    = newStrikes >= STRIKE_SUSPEND_THRESHOLD;

      await db.sportsFacility.update({
        where: { id: facilityId },
        data: {
          cancelStrikeCount: newStrikes,
          strikeResetAt:     new Date(),
          ...(suspend && { isListingSuspended: true }),
        },
      });

      await db.facilityBooking.update({
        where: { id },
        data: {
          status:       "CANCELLED",
          cancelledAt:  new Date(),
          cancelledBy:  "worker",
          refundPercent: 100,
          refundAmount:  booking.totalAmount,
          ...(isOnlinePaid && { refundStatus: "NEEDED" }),
        },
      });

      // Admin notifications
      const adminMsgs: { title: string; message: string; type: "error" | "warning" }[] = [];
      if (isOnlinePaid) {
        adminMsgs.push({
          title:   "Refund Required — Worker Cancellation",
          message: `${workerName} cancelled a paid booking by ${booking.user.name} at ${booking.facility.name} on ${dateStr}. Full refund: Rs. ${booking.totalAmount.toLocaleString()}.`,
          type:    "error",
        });
      }
      if (suspend) {
        adminMsgs.push({
          title:   "Facility Suspended — Strike Limit Reached",
          message: `${booking.facility.name} reached ${newStrikes} cancellation strikes (latest by worker ${workerName}) and has been automatically suspended.`,
          type:    "error",
        });
      } else {
        adminMsgs.push({
          title:   "Worker Cancelled a Booking",
          message: `${workerName} cancelled booking for ${booking.user.name} at ${booking.facility.name} on ${dateStr}. Strike ${newStrikes}/${STRIKE_SUSPEND_THRESHOLD} on this facility.`,
          type:    "warning",
        });
      }

      await db.notification.createMany({
        data: admins.flatMap((a) => adminMsgs.map((msg) => ({ userId: a.id, ...msg }))),
      });

      // Notify user
      const cancelMsg = isOnlinePaid
        ? `Your booking at ${booking.facility.name} on ${dateStr} was cancelled. Your full payment will be refunded — our team will be in touch.`
        : `Your booking at ${booking.facility.name} on ${dateStr} was cancelled.`;
      await db.notification.create({
        data: { userId: booking.user.id, title: "Booking Cancelled", message: cancelMsg, type: "warning" },
      });

      // Notify owner
      await db.notification.create({
        data: {
          userId:  ownerId,
          title:   "Booking Cancelled by Worker",
          message: `${workerName} cancelled the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}). Strike ${newStrikes}/${STRIKE_SUSPEND_THRESHOLD} on your facility.`,
          type:    "warning",
        },
      });

      if (booking.contactNumber) {
        await sendSMS(booking.contactNumber, `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} was cancelled. ${isOnlinePaid ? "A full refund will be processed." : "Contact support if needed."}`);
      }

      return Response.json({ message: "Booking cancelled. Strike recorded on facility." });
    }

    // ── NO_SHOW ───────────────────────────────────────────────────────────────
    if (status === "NO_SHOW") {
      const newNoShowCount = (booking.user.noShowCount ?? 0) + 1;
      const restrictOnline = newNoShowCount >= NO_SHOW_ONLINE_THRESHOLD;
      const suspendUser    = newNoShowCount >= NO_SHOW_SUSPEND_THRESHOLD;

      await db.facilityBooking.update({
        where: { id },
        data: { status: "NO_SHOW", noShowMarkedAt: new Date() },
      });

      await db.user.update({
        where: { id: booking.user.id },
        data: {
          noShowCount:          newNoShowCount,
          ...(restrictOnline && { requiresOnlinePayment: true }),
          ...(suspendUser    && { isBookingSuspended:    true }),
        },
      });

      // Notify user
      const noShowMsg = suspendUser
        ? `You were marked as a no-show for your booking at ${booking.facility.name} on ${dateStr}. Your account has been suspended from making new bookings.`
        : restrictOnline
        ? `You were marked as a no-show at ${booking.facility.name} on ${dateStr}. You now need to pay online for future bookings.`
        : `You were marked as a no-show for your booking at ${booking.facility.name} on ${dateStr}. Please ensure you attend or cancel in advance.`;
      await db.notification.create({
        data: { userId: booking.user.id, title: "No-Show Recorded", message: noShowMsg, type: "warning" },
      });

      // Notify owner
      await db.notification.create({
        data: {
          userId:  ownerId,
          title:   "No-Show Marked by Worker",
          message: `${workerName} marked ${booking.user.name}'s booking on ${dateStr} as a no-show (total: ${newNoShowCount}).`,
          type:    "info",
        },
      });

      // Notify admins if user was restricted or suspended
      if (restrictOnline || suspendUser) {
        await db.notification.createMany({
          data: admins.map((a) => ({
            userId:  a.id,
            title:   suspendUser ? "User Suspended — No-Show Limit" : "User Restricted — Online Payment Required",
            message: `${booking.user.name} has ${newNoShowCount} no-shows. ${suspendUser ? "Account suspended." : "Restricted to online payments only."}`,
            type:    (suspendUser ? "error" : "warning") as "error" | "warning",
          })),
        });
      }

      return Response.json({ message: `No-show recorded. User no-show count: ${newNoShowCount}.` });
    }

    return Response.json({ error: "Unhandled status." }, { status: 400 });
  } catch (err) {
    console.error("[PUT /api/worker/bookings/:id/status]", err);
    return Response.json({ error: "Failed to update booking status." }, { status: 500 });
  }
}
