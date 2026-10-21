import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { slotInstant } from "@/lib/local-time";
import { moveBooking } from "@/lib/booking-status";
import { NO_SHOW_DISPUTE_HOURS } from "@/lib/trust";
import { createNotification } from "@/lib/notify";
import { sendNoShowRecordedEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/lobby-payments";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const profile = await db.groundOwnerProfile.findUnique({
      where:   { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const facilityIds = profile.facilities.map((f) => f.id);

    const booking = await db.facilityBooking.findFirst({
      where: { id, facilityId: { in: facilityIds } },
      include: {
        facility: { select: { name: true } },
        user:     { select: { id: true, name: true, email: true, noShowCount: true, isBookingSuspended: true } },
      },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });

    if (booking.isOpenMatch) {
      return Response.json(
        { error: "No-show cannot be recorded for open match bookings. The slot was booked by GoPlay Connect." },
        { status: 400 },
      );
    }

    if (booking.status !== "CONFIRMED") {
      return Response.json({ error: "Only confirmed bookings can be marked as no-show." }, { status: 400 });
    }

    // Session must have already started
    const slotStart = slotInstant(booking.bookingDate, booking.startTime);
    if (slotStart > new Date()) {
      return Response.json({ error: "Cannot mark no-show before the session start time." }, { status: 400 });
    }

    // The report goes to GoPlay's review queue. It counts against the player only when an admin
    // confirms it, or after NO_SHOW_DISPUTE_HOURS without a dispute (see autoConfirmNoShows).
    const marked = await moveBooking(id, "CONFIRMED", { status: "NO_SHOW", noShowMarkedAt: new Date(), noShowMarkedBy: session.user.id, noShowReview: "PENDING" });
    if (!marked) return Response.json({ error: "This booking was just changed by someone else. Refresh and try again." }, { status: 409 });

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    const playerMsg = `${booking.facility.name} reported that you didn't turn up on ${dateStr}. If you did play, dispute it from your booking within ${NO_SHOW_DISPUTE_HOURS} hours; otherwise it counts on your account.`;

    await createNotification({
      userId:  booking.userId,
      title:   "No-Show Recorded",
      message: playerMsg,
      type:    "warning",
      link:    `/my-bookings`,
    });
    void sendNoShowRecordedEmail({
      to: booking.contactEmail ?? booking.user.email, name: booking.user.name, facilityName: booking.facility.name,
      date: dateStr, startTime: booking.startTime, endTime: booking.endTime, bookingId: booking.id,
    });
    await notifyAdmins("No-show to review", `${booking.facility.name} reported ${booking.user.name} as a no-show on ${dateStr} ${booking.startTime}.`, "/admin/trust");

    // Same fields as before for older app builds; the count only changes once the report counts
    return Response.json({
      message:     `No-show reported. GoPlay reviews it; it counts if the player doesn't dispute it within ${NO_SHOW_DISPUTE_HOURS} hours.`,
      noShowCount: booking.user.noShowCount,
      restricted:  false,
      suspended:   false,
    });
  } catch (err) {
    console.error("[PUT /api/ground-owner/bookings/:id/noshow]", err);
    return Response.json({ error: "Failed to mark no-show." }, { status: 500 });
  }
}
