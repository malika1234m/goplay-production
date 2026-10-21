import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";
import { getReceiptWindowMinutes } from "@/lib/settings";
import { staleUnpaidBookingWhere, staleUnpaidSpotWhere } from "@/lib/payment-review";
import { pruneRateLimits } from "@/lib/rateLimiter";

// Releases "Pay online" bookings and open match spots that never got an accepted receipt
// within the receipt window. Booking creation also releases these lazily per slot.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowMinutes = await getReceiptWindowMinutes();
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

  const expired = await db.facilityBooking.findMany({
    where:  staleUnpaidBookingWhere(cutoff),
    select: { id: true, user: { select: { id: true } }, facility: { select: { name: true } } },
  });
  // Re-check the full "unpaid and stale" condition on write: a receipt uploaded since the read keeps the slot
  const released: typeof expired = [];
  for (const b of expired) {
    const { count } = await db.facilityBooking.updateMany({
      where: { id: b.id, ...staleUnpaidBookingWhere(cutoff) },
      data:  { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "system" },
    });
    if (count === 1) released.push(b);
  }
  if (released.length > 0) {
    await Promise.allSettled(released.map((b) => createNotification({
      userId:  b.user.id,
      title:   "Booking Expired",
      message: `Your booking at ${b.facility.name} was cancelled because no accepted payment receipt was received in time. The slot is available again.`,
      type:    "warning",
    })));
  }

  const staleSpots = await db.openMatchSpot.findMany({
    where:  staleUnpaidSpotWhere(cutoff),
    select: { id: true, userId: true, matchId: true, groupSize: true },
  });
  for (const spot of staleSpots) {
    const releasedSpot = await db.openMatchSpot.updateMany({
      where: { id: spot.id, ...staleUnpaidSpotWhere(cutoff) },
      data:  { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (releasedSpot.count === 0) continue;
    await db.openMatch.updateMany({
      where: { id: spot.matchId, status: "COLLECTING" },
      data:  { spotsReserved: { decrement: spot.groupSize } },
    });
    await db.openMatch.updateMany({
      where: { id: spot.matchId, status: "COLLECTING", spotsReserved: { lte: 0 } },
      data:  { status: "CANCELLED" },
    });
    await createNotification({
      userId:  spot.userId,
      title:   "Open match spot released",
      message: "Your spot was released because no accepted payment receipt was received in time. You can join again if there is still room.",
      type:    "warning",
      link:    `/open-matches/${spot.matchId}`,
    });
  }

  console.log(`[cron/release-pending-slots] Released ${released.length} bookings and ${staleSpots.length} spots (cutoff: ${cutoff.toISOString()})`);
  // Daily housekeeping for the shared rate-limit counters
  const rateLimitsPruned = await pruneRateLimits();

  return Response.json({ released: released.length, spotsReleased: staleSpots.length, rateLimitsPruned, cutoff: cutoff.toISOString() });
}
