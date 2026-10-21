import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { isAllowed } from "@/lib/rateLimiter";
import { notifyAdmins } from "@/lib/lobby-payments";
import { createNotification } from "@/lib/notify";

// POST /api/user/bookings/[id]/refund-dispute — { message } — "the ground marked my refund sent, but it never arrived".
// Grounds mark their own refunds as sent, so the player's word opens a complaint GoPlay follows up.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
    if (!(await isAllowed(`refund-dispute:${session.user.id}`, 5, 60 * 60_000))) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    const { id } = await params;
    const { message } = await req.json().catch(() => ({}));
    const text = String(message ?? "").trim();
    if (text.length < 10)   return Response.json({ error: "Tell us what happened in at least 10 characters." }, { status: 400 });
    if (text.length > 1000) return Response.json({ error: "Please keep it under 1000 characters." }, { status: 400 });

    const b = await db.facilityBooking.findFirst({
      where:  { id, userId: session.user.id },
      select: { refundStatus: true, refundProcessedAt: true, refundAmount: true, totalAmount: true, facilityId: true, facility: { select: { name: true, owner: { select: { userId: true } } } } },
    });
    if (!b) return Response.json({ error: "Booking not found." }, { status: 404 });
    if (b.refundStatus !== "PROCESSED") return Response.json({ error: "This booking has no refund marked as sent." }, { status: 409 });
    if (b.refundProcessedAt && Date.now() - b.refundProcessedAt.getTime() > 60 * 86_400_000) {
      return Response.json({ error: "This refund was marked sent more than 60 days ago. Contact GoPlay support." }, { status: 409 });
    }
    if (await db.paymentComplaint.findFirst({ where: { bookingId: id, status: "OPEN" }, select: { id: true } })) {
      return Response.json({ error: "You already have an open complaint for this booking. The GoPlay team will be in touch." }, { status: 409 });
    }

    await db.paymentComplaint.create({
      data: { userId: session.user.id, facilityId: b.facilityId, bookingId: id, message: `Refund not received: ${text}` },
    });
    const amount = (b.refundAmount ?? b.totalAmount).toLocaleString();
    await notifyAdmins("Refund not received", `${session.user.name ?? "A player"} says the Rs. ${amount} refund from ${b.facility.name} never arrived.`, "/admin/complaints");
    await createNotification({
      userId:  b.facility.owner.userId,
      title:   "Player says a refund didn't arrive",
      message: `A player says the Rs. ${amount} refund you marked as sent hasn't reached them. GoPlay will contact you; have the transfer receipt ready.`,
      type:    "warning",
    });
    return Response.json({ ok: true, message: "Thanks — GoPlay will check with the ground and get back to you." });
  } catch (err) {
    console.error("[POST /api/user/bookings/[id]/refund-dispute]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
