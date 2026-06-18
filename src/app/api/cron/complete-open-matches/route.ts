import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCommissionRate } from "@/lib/settings";

// Runs every hour. Auto-completes CONFIRMED + ONLINE + PAID bookings as soon as
// their session end time has passed (Sri Lanka local time, UTC+5:30).
// Cash-on-arrival bookings are skipped — ground owner/worker completes those manually.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Current time in Sri Lanka (UTC+5:30)
  const nowSL   = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const nowMins = nowSL.getUTCHours() * 60 + nowSL.getUTCMinutes();

  // UTC midnight of today — bookings before this date are unambiguously past
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  // Fetch past dates + today's bookings (we'll filter today's by endTime below)
  const candidates = await db.facilityBooking.findMany({
    where: {
      status:        "CONFIRMED",
      paymentMethod: "ONLINE",
      paymentStatus: "PAID",
      bookingDate:   { lte: todayUtc }, // include today; past dates always qualify
      earning:       { is: null },
    },
    select: {
      id: true, totalAmount: true, isOpenMatch: true,
      bookingDate: true,
      endTime: true, // stored as "HH:MM" in Sri Lanka local time
      facility: { select: { id: true, ownerId: true } },
    },
  });

  // For today's bookings, only proceed if the session end time has already passed
  const toComplete = candidates.filter((b) => {
    if (b.bookingDate.getTime() < todayUtc.getTime()) return true; // past date — always complete
    const [h, m] = b.endTime.split(":").map(Number);
    return nowMins >= h * 60 + m; // today — only if end time has passed
  });

  if (toComplete.length === 0) {
    return Response.json({ completed: 0 });
  }

  const PLATFORM_FEE = await getCommissionRate();
  let completed = 0;
  const errors: string[] = [];

  for (const b of toComplete) {
    try {
      const gross = b.totalAmount;
      const fee   = Math.round(gross * PLATFORM_FEE * 100) / 100;
      const net   = Math.round((gross - fee) * 100) / 100;

      await db.$transaction(async (tx) => {
        await tx.groundEarning.upsert({
          where:  { bookingId: b.id },
          create: {
            bookingId:      b.id,
            facilityId:     b.facility.id,
            ownerId:        b.facility.ownerId,
            grossAmount:    gross,
            platformFee:    fee,
            netAmount:      net,
            paymentMethod:  "ONLINE",
            cashConfirmed:  true,
            ...(b.isOpenMatch && { commissionNote: "GoPlay Connect — open match" }),
          },
          update: {},
        });

        await tx.facilityBooking.update({
          where: { id: b.id },
          data:  { status: "COMPLETED" },
        });
      });

      completed++;
    } catch (err) {
      console.error(`[cron/complete-open-matches] Failed for booking ${b.id}:`, err);
      errors.push(b.id);
    }
  }

  console.log(`[cron/complete-open-matches] Completed ${completed}/${toComplete.length} bookings`);
  return Response.json({ completed, errors: errors.length > 0 ? errors : undefined });
}
