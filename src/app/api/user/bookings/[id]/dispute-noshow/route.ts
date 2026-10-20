import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { isAllowed } from "@/lib/rateLimiter";
import { notifyAdmins } from "@/lib/lobby-payments";

// POST /api/user/bookings/[id]/dispute-noshow — { message } — "I was there": the player's side of a no-show report
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    if (!(await isAllowed(`noshow-dispute:${session.user.id}`, 5, 60 * 60_000))) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { id } = await params;
    const { message } = await req.json().catch(() => ({}));
    const text = String(message ?? "").trim();
    if (text.length < 10)   return Response.json({ error: "Tell us what happened in at least 10 characters." }, { status: 400 });
    if (text.length > 1000) return Response.json({ error: "Please keep it under 1000 characters." }, { status: 400 });

    const booking = await db.facilityBooking.findFirst({
      where:  { id, userId: session.user.id },
      select: { status: true, noShowReview: true, noShowDisputedAt: true, bookingDate: true, startTime: true, facility: { select: { name: true } } },
    });
    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });
    if (booking.status !== "NO_SHOW") return Response.json({ error: "This booking isn't marked as a no-show." }, { status: 409 });
    if (booking.noShowReview && booking.noShowReview !== "PENDING") {
      return Response.json({ error: "GoPlay has already reviewed this no-show." }, { status: 409 });
    }
    if (booking.noShowDisputedAt) return Response.json({ error: "You've already disputed this no-show — GoPlay is reviewing it." }, { status: 409 });

    await db.facilityBooking.update({
      where: { id },
      data:  { noShowDispute: text, noShowDisputedAt: new Date(), noShowReview: "PENDING" },
    });
    await notifyAdmins(
      "No-show disputed",
      `${session.user.name ?? "A player"} says they did play at ${booking.facility.name} on ${booking.bookingDate.toDateString()} ${booking.startTime}.`,
      "/admin/trust",
    );
    return Response.json({ ok: true, message: "Thanks — the GoPlay team will review it and let you know." });
  } catch (err) {
    console.error("[POST /api/user/bookings/[id]/dispute-noshow]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
