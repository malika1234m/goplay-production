import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(Number(searchParams.get("days") ?? "30"), 90);

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const earnings = await db.groundEarning.findMany({
      where: { ownerId: profile.id, earnedAt: { gte: since } },
      select: { earnedAt: true, netAmount: true },
      orderBy: { earnedAt: "asc" },
    });

    // Build day-by-day map using net amount (what owner actually earns)
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      map.set(d.toISOString().split("T")[0], 0);
    }
    for (const e of earnings) {
      const key = new Date(e.earnedAt).toISOString().split("T")[0];
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + e.netAmount);
    }

    const labels  = Array.from(map.keys()).map((d) =>
      new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    const revenue = Array.from(map.values());

    return Response.json({ trends: { labels, revenue } });
  } catch (err) {
    console.error("[GET /api/ground-owner/earnings/trends]", err);
    return Response.json({ error: "Failed to fetch trends." }, { status: 500 });
  }
}
