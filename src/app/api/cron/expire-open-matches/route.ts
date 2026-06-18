import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { expireLobby } from "@/lib/open-match-engine";

// Runs every 30 minutes via Vercel Cron.
// Finds all COLLECTING lobbies past their expiresAt and expires them (refunding all spots).
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await db.openMatch.findMany({
    where: { status: "COLLECTING", expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  let totalSpotsRefunded = 0;
  for (const { id } of expired) {
    totalSpotsRefunded += await expireLobby(id);
  }

  console.log(`[cron/expire-open-matches] Expired ${expired.length} lobbies, refunded ${totalSpotsRefunded} spots`);
  return Response.json({ expired: expired.length, spotsRefunded: totalSpotsRefunded });
}
