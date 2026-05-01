import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { queryPayHereStatus } from "@/lib/payhere";

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { bookingId } = await params;

    const booking = await db.facilityBooking.findUnique({
      where: { id: bookingId },
      include: {
        facility: {
          select: { name: true },
          include: { owner: { include: { user: { select: { id: true } } } } },
        },
        user: { select: { id: true, name: true } },
      },
    });

    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });
    if (booking.userId !== session.user.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    if (booking.paymentMethod !== "ONLINE") {
      return Response.json({ error: "This booking is not an online payment." }, { status: 400 });
    }
    if (booking.paymentStatus === "PAID") {
      return Response.json({ alreadyConfirmed: true, message: "Payment is already confirmed." });
    }

    const result = await queryPayHereStatus(booking.id);
    if (!result) {
      return Response.json({ error: "Could not reach PayHere. Please try again shortly." }, { status: 502 });
    }

    if (result.statusCode === 2) {
      await db.facilityBooking.update({
        where: { id: bookingId },
        data:  { status: "CONFIRMED", paymentStatus: "PAID", payHereOrderId: bookingId },
      });
      await db.notification.create({
        data: {
          userId:  booking.user.id,
          title:   "Payment Confirmed",
          message: `Your payment of Rs. ${booking.totalAmount.toLocaleString()} for ${booking.facility.name} was confirmed. Booking is now active!`,
          type:    "success",
        },
      });
      await db.notification.create({
        data: {
          userId:  booking.facility.owner.user.id,
          title:   "New Paid Booking",
          message: `${booking.user.name} has paid Rs. ${booking.totalAmount.toLocaleString()} online for ${booking.facility.name}. Booking confirmed.`,
          type:    "success",
        },
      });
      return Response.json({ confirmed: true, message: "Payment verified — your booking is now confirmed!" });
    }

    if (result.statusCode === -1 || result.statusCode === -2) {
      await db.facilityBooking.update({
        where: { id: bookingId },
        data:  { paymentStatus: "FAILED" },
      });
      return Response.json({ failed: true, message: "PayHere shows this payment as cancelled or failed." });
    }

    return Response.json({ pending: true, message: "Payment is still being processed by PayHere. Please wait a moment and try again." });
  } catch (err) {
    console.error("[POST /api/payhere/check/[bookingId]]", err);
    return Response.json({ error: "Failed to check payment status." }, { status: 500 });
  }
}
