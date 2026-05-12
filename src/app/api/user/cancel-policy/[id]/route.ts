import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  getCancellationPolicyFromTiers,
  loadPolicyTiers,
  CASH_CANCEL_WARN_THRESHOLD,
  CASH_CANCEL_BAN_THRESHOLD,
} from "@/lib/cancellation-policy";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const booking = await db.facilityBooking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            cashCancelCount:       true,
            noShowCount:           true,
            requiresOnlinePayment: true,
            isBookingSuspended:    true,
          },
        },
      },
    });

    if (!booking || booking.userId !== session.user.id) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    if (booking.status === "CANCELLED" || booking.status === "COMPLETED" || booking.status === "NO_SHOW") {
      return Response.json({ error: "Booking cannot be cancelled." }, { status: 400 });
    }

    const tiers           = await loadPolicyTiers();
    const policy          = getCancellationPolicyFromTiers(booking.bookingDate, booking.startTime, tiers);
    const isOnlinePaid    = booking.paymentMethod === "ONLINE" && booking.paymentStatus === "PAID";
    const refundAmount    = isOnlinePaid
      ? Math.round(booking.totalAmount * policy.refundPercent) / 100
      : 0;

    const cashCancelCount = booking.user.cashCancelCount;
    const cancelsUntilBan = CASH_CANCEL_BAN_THRESHOLD - cashCancelCount;
    const showCashWarning = booking.paymentMethod === "ON_ARRIVAL" &&
      cashCancelCount >= CASH_CANCEL_WARN_THRESHOLD - 1;

    return Response.json({
      paymentMethod:         booking.paymentMethod,
      paymentStatus:         booking.paymentStatus,
      totalAmount:           booking.totalAmount,
      isOnlinePaid,
      refundPercent:         policy.refundPercent,
      refundAmount,
      refundLabel:           policy.refundLabel,
      refundDescription:     policy.description,
      hoursUntil:            Math.round(policy.hoursUntil * 10) / 10,
      tier:                  policy.tier,
      cashCancelCount,
      cancelsUntilBan:       Math.max(0, cancelsUntilBan),
      showCashWarning,
      noShowCount:           booking.user.noShowCount,
      requiresOnlinePayment: booking.user.requiresOnlinePayment,
      isBookingSuspended:    booking.user.isBookingSuspended,
    });
  } catch (err) {
    console.error("[GET /api/user/cancel-policy/:id]", err);
    return Response.json({ error: "Failed to load policy." }, { status: 500 });
  }
}
