import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPayHereNotify } from "@/lib/payhere";
import { createNotification } from "@/lib/notify";
import { tryMatchLobby } from "@/lib/open-match-engine";

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

    const statusCode = Number(params.status_code);

    // ── Open match spot payments (order_id = "SPOT_<spotId>") ─────────────
    if (params.order_id.startsWith("SPOT_")) {
      const spotId = params.order_id.slice(5); // strip "SPOT_" prefix
      const amount = parseFloat(params.payhere_amount);

      if (statusCode === 2) {
        const updated = await db.openMatchSpot.updateMany({
          where: { id: spotId, paymentStatus: "PENDING" },
          data:  { paymentStatus: "PAID", amountPaid: amount, payHereOrderId: params.order_id },
        });

        if (updated.count > 0) {
          const spot = await db.openMatchSpot.findUnique({
            where:   { id: spotId },
            include: {
              match:    { select: { id: true, category: { select: { name: true } } } },
              user:     { select: { id: true, name: true } },
            },
          });
          if (spot) {
            await createNotification({
              userId:  spot.userId,
              title:   "Payment Confirmed — You're in the lobby!",
              message: `Your Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} payment was successful. We'll notify you when enough players join.`,
              type:    "success",
              link:    `/open-matches/${spot.matchId}`,
            });
            await tryMatchLobby(spot.matchId);
          }
        }
      } else if (statusCode === -1 || statusCode === -2) {
        const spot = await db.openMatchSpot.findUnique({
          where:  { id: spotId },
          select: { matchId: true, groupSize: true, userId: true, paymentStatus: true },
        });

        if (spot && spot.paymentStatus === "PENDING") {
          await db.openMatchSpot.updateMany({
            where: { id: spotId, paymentStatus: "PENDING" },
            data:  { status: "CANCELLED", paymentStatus: "FAILED", cancelledAt: new Date() },
          });
          // Release the held capacity
          await db.openMatch.updateMany({
            where: { id: spot.matchId, status: "COLLECTING" },
            data:  { spotsReserved: { decrement: spot.groupSize } },
          });
          await createNotification({
            userId:  spot.userId,
            title:   "Payment Failed",
            message: "Your open match spot payment could not be processed. Please try joining again.",
            type:    "error",
            link:    `/open-matches/${spot.matchId}`,
          });
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ── Regular facility booking payments ─────────────────────────────────
    const bookingId = params.order_id;

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
          await createNotification({
            userId:  booking.user.id,
            title:   "Payment Confirmed",
            message: `Your payment of Rs. ${booking.totalAmount.toLocaleString()} for ${booking.facility.name} was successful. Booking confirmed!`,
            type:    "success",
          });
          // Notify the ground owner
          await createNotification({
            userId:  booking.facility.owner.user.id,
            title:   "New Paid Booking",
            message: `${booking.user.name} has paid Rs. ${booking.totalAmount.toLocaleString()} online for ${booking.facility.name}. Booking is confirmed.`,
            type:    "success",
          });
        }
      }
    } else if (statusCode === -1 || statusCode === -2) {
      // Cancelled or failed — only update payment status, don't touch booking status
      // so the user can retry payment
      const updated = await db.facilityBooking.updateMany({
        where: { id: bookingId, status: { in: ["PENDING", "CONFIRMED"] } },
        data:  { paymentStatus: "FAILED" },
      });

      if (updated.count > 0) {
        const booking = await db.facilityBooking.findUnique({
          where: { id: bookingId },
          select: {
            user:     { select: { id: true } },
            facility: { select: { name: true } },
          },
        });
        if (booking) {
          await createNotification({
            userId:  booking.user.id,
            title:   "Payment Failed",
            message: `Your payment for ${booking.facility.name} could not be processed. Please try booking again.`,
            type:    "error",
          });
        }
      }
    } else if (statusCode === -3) {
      // Chargedback — cancel booking and reverse any GroundEarning
      const updated = await db.facilityBooking.updateMany({
        where: { id: bookingId, status: { notIn: ["CANCELLED"] } },
        data:  { paymentStatus: "REFUNDED", status: "CANCELLED" },
      });
      // If session was already completed and earning recorded, mark it as unconfirmed
      // so it drops out of the payout balance calculation
      await db.groundEarning.updateMany({
        where: { bookingId, cashConfirmed: true },
        data:  { cashConfirmed: false, commissionNote: "Reversed: PayHere chargeback." },
      });

      if (updated.count > 0) {
        const booking = await db.facilityBooking.findUnique({
          where: { id: bookingId },
          select: {
            totalAmount: true,
            user:        { select: { id: true } },
            facility: {
              select: { name: true },
              include: { owner: { include: { user: { select: { id: true } } } } },
            },
          },
        });
        if (booking) {
          await createNotification({
            userId:  booking.user.id,
            title:   "Payment Chargedback",
            message: `A chargeback was raised on your payment for ${booking.facility.name}. Your booking has been cancelled. Please contact us if this was a mistake.`,
            type:    "error",
          });
          await createNotification({
            userId:  booking.facility.owner.user.id,
            title:   "Booking Chargedback",
            message: `A PayHere chargeback was raised on a booking at ${booking.facility.name} (Rs. ${booking.totalAmount.toLocaleString()}). The booking has been cancelled and the earning reversed.`,
            type:    "error",
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[POST /api/payhere/notify]", err);
    // Still return 200 so PayHere doesn't keep retrying with a broken webhook
    return new Response("OK", { status: 200 });
  }
}
