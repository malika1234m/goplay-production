import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPayHereNotify } from "@/lib/payhere";

/**
 * PayHere calls this endpoint after every payment attempt.
 * It is NOT triggered by the user's browser — PayHere's servers POST here directly.
 * Must return HTTP 200 for PayHere to consider the notification delivered.
 *
 * status_code meanings:
 *   2  = success (paid)
 *   0  = pending
 *  -1  = cancelled
 *  -2  = failed
 *  -3  = chargedback
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();

    const params = {
      merchant_id:      body.get("merchant_id")      as string,
      order_id:         body.get("order_id")         as string,
      payhere_amount:   body.get("payhere_amount")   as string,
      payhere_currency: body.get("payhere_currency") as string,
      status_code:      body.get("status_code")      as string,
      md5sig:           body.get("md5sig")           as string,
    };

    // Reject if any required field is missing
    if (Object.values(params).some((v) => !v)) {
      console.warn("[PayHere notify] Missing fields", params);
      return new Response("Bad Request", { status: 400 });
    }

    // Verify signature
    if (!verifyPayHereNotify(params)) {
      console.warn("[PayHere notify] Invalid signature for order", params.order_id);
      return new Response("Invalid signature", { status: 400 });
    }

    const bookingId  = params.order_id;
    const statusCode = Number(params.status_code);

    if (statusCode === 2) {
      // Payment successful — only update if booking hasn't been cancelled already
      const updated = await db.facilityBooking.updateMany({
        where: { id: bookingId, status: { in: ["PENDING", "CONFIRMED"] } },
        data:  { status: "CONFIRMED", paymentStatus: "PAID", payHereOrderId: bookingId },
      });

      if (updated.count > 0) {
        const booking = await db.facilityBooking.findUnique({
          where: { id: bookingId },
          include: {
            user:     { select: { id: true, name: true } },
            facility: {
              select: { name: true },
              include: { owner: { include: { user: { select: { id: true } } } } },
            },
          },
        });
        if (booking) {
          // Notify the player
          await db.notification.create({
            data: {
              userId:  booking.user.id,
              title:   "Payment Confirmed",
              message: `Your payment of Rs. ${booking.totalAmount.toLocaleString()} for ${booking.facility.name} was successful. Booking confirmed!`,
              type:    "success",
            },
          });
          // Notify the ground owner
          await db.notification.create({
            data: {
              userId:  booking.facility.owner.user.id,
              title:   "New Paid Booking",
              message: `${booking.user.name} has paid Rs. ${booking.totalAmount.toLocaleString()} online for ${booking.facility.name}. Booking is confirmed.`,
              type:    "success",
            },
          });
        }
      }
    } else if (statusCode === -1 || statusCode === -2) {
      // Cancelled or failed — only update payment status, don't touch booking status
      await db.facilityBooking.updateMany({
        where: { id: bookingId, status: { in: ["PENDING", "CONFIRMED"] } },
        data:  { paymentStatus: "FAILED" },
      });
    } else if (statusCode === -3) {
      // Chargedback — cancel booking and reverse any GroundEarning
      await db.facilityBooking.updateMany({
        where: { id: bookingId, status: { notIn: ["CANCELLED"] } },
        data:  { paymentStatus: "REFUNDED", status: "CANCELLED" },
      });
      // If session was already completed and earning recorded, mark it as unconfirmed
      // so it drops out of the payout balance calculation
      await db.groundEarning.updateMany({
        where: { bookingId, cashConfirmed: true },
        data:  { cashConfirmed: false, commissionNote: "Reversed: PayHere chargeback." },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[POST /api/payhere/notify]", err);
    // Still return 200 so PayHere doesn't keep retrying with a broken webhook
    return new Response("OK", { status: 200 });
  }
}
