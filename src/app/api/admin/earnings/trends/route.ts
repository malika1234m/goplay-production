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

    const bookings = await db.facilityBooking.findMany({
      where: {
        status:      "COMPLETED",
        bookingDate: { gte: since },
      },
      select: { bookingDate: true, totalAmount: true },
      orderBy: { bookingDate: "asc" },
    });

    // Build full date range map
    const map = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      map.set(d.toISOString().split("T")[0], 0);
    }
    for (const b of bookings) {
      const key = new Date(b.bookingDate).toISOString().split("T")[0];
      map.set(key, (map.get(key) ?? 0) + b.totalAmount);
    }

    const labels  = Array.from(map.keys()).map((d) =>
      new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
    const revenue = Array.from(map.values());

    return Response.json({ trends: { labels, revenue } });
  } catch (err) {
    console.error("[GET /api/admin/earnings/trends]", err);
    return Response.json({ error: "Failed to fetch trends." }, { status: 500 });
  }
}
