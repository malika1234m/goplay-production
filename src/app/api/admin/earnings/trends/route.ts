import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { financeTrend } from "@/lib/admin-finance";

// GET /api/admin/earnings/trends?days=30 — per day: booking value (paid to grounds directly)
// and GoPlay's earnings (commission + open match margin). `revenue` is the booking value.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const asked = Number(new URL(req.url).searchParams.get("days") ?? "30");
    const days  = Number.isFinite(asked) ? Math.min(Math.max(Math.round(asked), 1), 186) : 30;
    const trends = (await financeTrend(days)).map((p) => ({ ...p, revenue: p.bookingValue }));
    return Response.json({ trends }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET /api/admin/earnings/trends]", err);
    return Response.json({ error: "Failed to fetch trends." }, { status: 500 });
  }
}
