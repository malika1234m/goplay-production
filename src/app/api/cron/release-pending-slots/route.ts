import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";
import { getReceiptWindowMinutes } from "@/lib/settings";
import { staleUnpaidBookingWhere, staleUnpaidSpotWhere } from "@/lib/payment-review";

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
  if (expired.length > 0) {
    await db.facilityBooking.updateMany({
      where: { id: { in: expired.map((b) => b.id) }, status: "PENDING" },
      data:  { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "system" },
    });
    await Promise.allSettled(expired.map((b) => createNotification({
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
    const released = await db.openMatchSpot.updateMany({
      where: { id: spot.id, status: "RESERVED" },
      data:  { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (released.count === 0) continue;
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

  console.log(`[cron/release-pending-slots] Released ${expired.length} bookings and ${staleSpots.length} spots (cutoff: ${cutoff.toISOString()})`);
  return Response.json({ released: expired.length, spotsReleased: staleSpots.length, cutoff: cutoff.toISOString() });
}
