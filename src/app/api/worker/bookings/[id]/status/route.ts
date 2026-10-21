import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { earningFigures } from "@/lib/lobby-payments";
import { groundTransitionError, moveBooking } from "@/lib/booking-status";
import { getSession } from "@/lib/mobile-auth";
import { slotInstant } from "@/lib/local-time";
import { sendSMS } from "@/lib/sms";
import { sendBookingConfirmedEmail, sendBookingCancelledEmail, sendNoShowRecordedEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/lobby-payments";
import { createNotification } from "@/lib/notify";
import { STRIKE_SUSPEND_THRESHOLD, STRIKE_RESET_DAYS } from "@/lib/cancellation-policy";
import { NO_SHOW_DISPUTE_HOURS } from "@/lib/trust";

async function getWorkerFacilityId(userId: string): Promise<string | null> {
  const w = await db.facilityWorker.findUnique({ where: { userId } });
  return w?.facilityId ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(req);
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
            email:                true,
            noShowCount:          true,
            requiresOnlinePayment: true,
            isBookingSuspended:    true,
          },
        },
      },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    // Same transition rules as the owner (no-shows go through GoPlay's review)
    const transitionError = groundTransitionError(booking, status);
    if (transitionError) return Response.json({ error: transitionError }, { status: 400 });
    const changedElsewhere = () => Response.json({ error: "This booking was just changed by someone else. Refresh and try again." }, { status: 409 });

    if (status === "COMPLETED") {
      const sessionEnd = slotInstant(booking.bookingDate, booking.endTime);
      if (sessionEnd > new Date()) {
        return Response.json({ error: "Cannot mark complete before the session has ended." }, { status: 400 });
      }
    }

    if (status === "NO_SHOW") {
      if (booking.status !== "CONFIRMED") {
        return Response.json({ error: "Only confirmed bookings can be marked as no-show." }, { status: 400 });
      }
      const slotStart = slotInstant(booking.bookingDate, booking.startTime);
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
      if (!(await moveBooking(id, booking.status, updateData))) return changedElsewhere();
      const updated = await db.facilityBooking.findUniqueOrThrow({ where: { id } });

      const profile = await db.groundOwnerProfile.findUnique({ where: { userId: ownerId } });
      if (profile) {
        // upsert: a concurrent completion can't fail on the unique bookingId
        await db.groundEarning.upsert({
          where:  { bookingId: id },
          update: {},
          create: {
            bookingId:     id,
            facilityId:    booking.facilityId,
            ownerId:       profile.id,
            ...(await earningFigures(booking)),
            paymentMethod: booking.paymentMethod,
            cashConfirmed: booking.paymentMethod === "ONLINE"
              ? booking.paymentStatus === "PAID"
              : (cashReceived === true),
          },
        });
      }

      await createNotification({
        userId:  booking.user.id,
        title:   "Booking Completed",
        message: `Your session at ${booking.facility.name} is marked as completed. Thanks for playing!`,
        type:    "info",
      });
      await createNotification({
        userId:  ownerId,
        title:   "Booking Completed by Worker",
        message: `${workerName} marked the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}) as completed.`,
        type:    "info",
      });

      if (booking.contactNumber) {
        await sendSMS(booking.contactNumber, `GoPlay: Your session at ${booking.facility.name} on ${dateStr} is complete. Thanks for playing!`);
      }

      return Response.json({ booking: updated, message: "Booking marked as completed." });
    }

    // ── CONFIRMED ─────────────────────────────────────────────────────────────
    if (status === "CONFIRMED") {
      if (!(await moveBooking(id, booking.status, { status }))) return changedElsewhere();
      const updated = await db.facilityBooking.findUniqueOrThrow({ where: { id } });
      await createNotification({
        userId:  booking.user.id,
        title:   "Booking Confirmed",
        message: `Your booking at ${booking.facility.name} has been confirmed!`,
        type:    "success",
      });
      await createNotification({
        userId:  ownerId,
        title:   "Booking Confirmed by Worker",
        message: `${workerName} confirmed the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}).`,
        type:    "info",
      });
      if (booking.contactNumber) {
        await sendSMS(booking.contactNumber, `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} from ${booking.startTime} to ${booking.endTime} has been confirmed. See you there!`);
      }
      // Same email the owner's confirm sends — fire-and-forget
      if (!booking.isOpenMatch) {
        void sendBookingConfirmedEmail({
          to:            booking.contactEmail ?? booking.user.email ?? "",
          name:          booking.user.name ?? "Player",
          facilityName:  booking.facility.name,
          date:          dateStr,
          startTime:     booking.startTime,
          endTime:       booking.endTime,
          totalAmount:   booking.totalAmount,
          paymentMethod: booking.paymentMethod,
          bookingId:     booking.id,
        });
      }
      return Response.json({ booking: updated, message: "Booking confirmed." });
    }

    // ── CANCELLED — strike goes on the facility ────────────────────────────
    if (status === "CANCELLED") {
      const fac = booking.facility;
      const isOnlinePaid = booking.paymentMethod === "ONLINE" && ["PAID", "RECEIPT_SUBMITTED"].includes(booking.paymentStatus);

      // 90-day strike reset
      let currentStrikes = fac.cancelStrikeCount;
      if (fac.strikeResetAt) {
        const daysSince = (Date.now() - fac.strikeResetAt.getTime()) / 86_400_000;
        if (daysSince >= STRIKE_RESET_DAYS) currentStrikes = 0;
      }
      const newStrikes = currentStrikes + 1;
      const suspend    = newStrikes >= STRIKE_SUSPEND_THRESHOLD;

      const cancelled = await moveBooking(id, booking.status, {
        status:        "CANCELLED",
        cancelledAt:   new Date(),
        cancelledBy:   "worker",
        refundPercent: 100,
        refundAmount:  booking.totalAmount,
        ...(isOnlinePaid && { refundStatus: "NEEDED" as const }),
      });
      if (!cancelled) return changedElsewhere();

      await db.sportsFacility.update({
        where: { id: facilityId },
        data: {
          cancelStrikeCount: newStrikes,
          strikeResetAt:     new Date(),
          ...(suspend && { isListingSuspended: true }),
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
        ? `Your booking at ${booking.facility.name} on ${dateStr} was cancelled. The ground will refund your full payment by bank transfer.`
        : `Your booking at ${booking.facility.name} on ${dateStr} was cancelled.`;
      await createNotification({ userId: booking.user.id, title: "Booking Cancelled", message: cancelMsg, type: "warning" });

      // Notify owner
      await createNotification({
        userId:  ownerId,
        title:   "Booking Cancelled by Worker",
        message: `${workerName} cancelled the booking by ${booking.user.name} on ${dateStr} (${booking.startTime}–${booking.endTime}). Strike ${newStrikes}/${STRIKE_SUSPEND_THRESHOLD} on your facility.`,
        type:    "warning",
      });

      if (booking.contactNumber) {
        await sendSMS(booking.contactNumber, `GoPlay: Your booking at ${booking.facility.name} on ${dateStr} was cancelled. ${isOnlinePaid ? "A full refund will be processed." : "Contact support if needed."}`);
      }
      if (!booking.isOpenMatch) {
        void sendBookingCancelledEmail({
          to:           booking.contactEmail ?? booking.user.email ?? "",
          name:         booking.user.name ?? "Player",
          facilityName: booking.facility.name,
          date:         dateStr,
          startTime:    booking.startTime,
          endTime:      booking.endTime,
          cancelledBy:  "owner",
          refundNeeded: isOnlinePaid,
        });
      }

      return Response.json({ message: "Booking cancelled. Strike recorded on facility." });
    }

    // ── NO_SHOW ───────────────────────────────────────────────────────────────
    if (status === "NO_SHOW") {
      // Into GoPlay's review queue; it counts only once confirmed or left undisputed for NO_SHOW_DISPUTE_HOURS
      const marked = await moveBooking(id, "CONFIRMED", { status: "NO_SHOW", noShowMarkedAt: new Date(), noShowMarkedBy: session.user.id, noShowReview: "PENDING" });
      if (!marked) return changedElsewhere();

      await createNotification({
        userId:  booking.user.id,
        title:   "No-Show Recorded",
        message: `${booking.facility.name} reported that you didn't turn up on ${dateStr}. If you did play, dispute it from your booking within ${NO_SHOW_DISPUTE_HOURS} hours; otherwise it counts on your account.`,
        type:    "warning",
        link:    "/my-bookings",
      });
      void sendNoShowRecordedEmail({
        to: booking.contactEmail ?? booking.user.email ?? "", name: booking.user.name ?? "Player", facilityName: booking.facility.name,
        date: dateStr, startTime: booking.startTime, endTime: booking.endTime, bookingId: booking.id,
      });
      await notifyAdmins("No-show to review", `${workerName} (worker at ${booking.facility.name}) reported ${booking.user.name} as a no-show on ${dateStr} ${booking.startTime}.`, "/admin/trust");
      await createNotification({
        userId:  ownerId,
        title:   "No-Show Marked by Worker",
        message: `${workerName} marked ${booking.user.name}'s booking on ${dateStr} as a no-show. GoPlay reviews every report.`,
        type:    "info",
      });

      return Response.json({ message: `No-show reported. It counts if the player doesn't dispute it within ${NO_SHOW_DISPUTE_HOURS} hours.` });
    }

    return Response.json({ error: "Unhandled status." }, { status: 400 });
  } catch (err) {
    console.error("[PUT /api/worker/bookings/:id/status]", err);
    return Response.json({ error: "Failed to update booking status." }, { status: 500 });
  }
}
