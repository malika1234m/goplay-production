import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";

// Cancels PENDING online bookings where payment was not completed within 30 minutes.
// Triggered by Vercel Cron every 10 minutes.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

  const expired = await db.facilityBooking.findMany({
    where: {
      status:        "PENDING",
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      createdAt:     { lt: cutoff },
    },
    select: {
      id:       true,
      user:     { select: { id: true } },
      facility: { select: { name: true } },
    },
  });

  if (expired.length === 0) {
    return Response.json({ released: 0 });
  }

  await db.facilityBooking.updateMany({
    where: { id: { in: expired.map((b) => b.id) } },
    data:  { status: "CANCELLED" },
  });

  // Notify each user that their payment window closed and the slot was released
  await Promise.allSettled(
    expired.map((b) =>
      createNotification({
        userId:  b.user.id,
        title:   "Booking Expired",
        message: `Your booking at ${b.facility.name} was not paid within 30 minutes and has been cancelled. The slot is now available again.`,
        type:    "warning",
      }),
    ),
  );

  console.log(`[cron/release-pending-slots] Released ${expired.length} expired slots (cutoff: ${cutoff.toISOString()})`);
  return Response.json({ released: expired.length, cutoff: cutoff.toISOString() });
}
