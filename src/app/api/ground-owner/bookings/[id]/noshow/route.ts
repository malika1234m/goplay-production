import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NO_SHOW_ONLINE_THRESHOLD, NO_SHOW_SUSPEND_THRESHOLD } from "@/lib/cancellation-policy";

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
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

    if (booking.status !== "CONFIRMED") {
      return Response.json({ error: "Only confirmed bookings can be marked as no-show." }, { status: 400 });
    }

    // Session must have already started
    const [h, m]  = booking.startTime.split(":").map(Number);
    const slotStart = new Date(booking.bookingDate);
    slotStart.setHours(h, m, 0, 0);
    if (slotStart > new Date()) {
      return Response.json({ error: "Cannot mark no-show before the session start time." }, { status: 400 });
    }

    const now         = new Date();
    const newCount    = booking.user.noShowCount + 1;
    const requireOnline = newCount >= NO_SHOW_ONLINE_THRESHOLD;
    const suspend       = newCount >= NO_SHOW_SUSPEND_THRESHOLD;

    await db.facilityBooking.update({
      where: { id },
      data:  { status: "NO_SHOW", noShowMarkedAt: now },
    });

    await db.user.update({
      where: { id: booking.userId },
      data: {
        noShowCount:           newCount,
        ...(requireOnline ? { requiresOnlinePayment: true } : {}),
        ...(suspend       ? { isBookingSuspended:    true } : {}),
      },
    });

    const dateStr = new Date(booking.bookingDate).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

    let playerMsg = `Your booking at ${booking.facility.name} on ${dateStr} was marked as a no-show.`;
    if (suspend) {
      playerMsg += " Your account has been suspended due to repeated no-shows. Please contact support.";
    } else if (requireOnline) {
      playerMsg += " Future bookings at cash-on-arrival facilities will require online payment.";
    }

    await db.notification.create({
      data: {
        userId:  booking.userId,
        title:   "No-Show Recorded",
        message: playerMsg,
        type:    "warning",
      },
    });

    if (suspend || requireOnline) {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminMsg = suspend
        ? `${booking.user.name} has been suspended after ${newCount} no-shows.`
        : `${booking.user.name} now requires online payment after ${newCount} no-shows.`;
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          title:   suspend ? "User Suspended — No-Shows" : "User Restricted — No-Shows",
          message: adminMsg,
          type:    suspend ? "error" as const : "warning" as const,
        })),
      });
    }

    return Response.json({
      message:    "Booking marked as no-show.",
      noShowCount: newCount,
      restricted:  requireOnline,
      suspended:   suspend,
    });
  } catch (err) {
    console.error("[PUT /api/ground-owner/bookings/:id/noshow]", err);
    return Response.json({ error: "Failed to mark no-show." }, { status: 500 });
  }
}
