import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// Cancels PENDING online bookings where payment was not completed within 30 minutes.
// Triggered by Vercel Cron every 10 minutes.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

  const result = await db.facilityBooking.updateMany({
    where: {
      status:        "PENDING",
      paymentMethod: "ONLINE",
      paymentStatus: "PENDING",
      createdAt:     { lt: cutoff },
    },
    data: { status: "CANCELLED" },
  });

  console.log(`[cron/release-pending-slots] Released ${result.count} expired slots (cutoff: ${cutoff.toISOString()})`);
  return Response.json({ released: result.count, cutoff: cutoff.toISOString() });
}
