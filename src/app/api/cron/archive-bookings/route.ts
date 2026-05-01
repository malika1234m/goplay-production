import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// Archives COMPLETED and CANCELLED bookings older than 2 years.
// Triggered by Vercel Cron (vercel.json) or any HTTP GET with the secret header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);

  const result = await db.facilityBooking.updateMany({
    where: {
      archivedAt: null,
      status:     { in: ["COMPLETED", "CANCELLED"] },
      bookingDate: { lt: cutoff },
    },
    data: { archivedAt: new Date() },
  });

  console.log(`[cron/archive-bookings] Archived ${result.count} bookings (cutoff: ${cutoff.toISOString()})`);
  return Response.json({ archived: result.count, cutoff: cutoff.toISOString() });
}
