import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(Number(searchParams.get("days") ?? "30"), 90);

    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    // DB-level groupBy — returns one row per day instead of every booking row
    const grouped = await db.facilityBooking.groupBy({
      by:      ["bookingDate"],
      where:   { status: "COMPLETED", bookingDate: { gte: since } },
      _sum:    { totalAmount: true },
      orderBy: { bookingDate: "asc" },
    });

    // Fill the full date range with zeroes, then overlay DB results
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      map.set(d.toISOString().split("T")[0], 0);
    }
    for (const g of grouped) {
      const key = new Date(g.bookingDate).toISOString().split("T")[0];
      map.set(key, g._sum.totalAmount ?? 0);
    }

    const trends = Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));

    return Response.json({ trends }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[GET /api/admin/earnings/trends]", err);
    return Response.json({ error: "Failed to fetch trends." }, { status: 500 });
  }
}
