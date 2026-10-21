import { auth } from "@/lib/auth";
import { financeSummary, financeByFacility } from "@/lib/admin-finance";

// GET /api/admin/earnings — GoPlay's earnings (commission owed by grounds + open match margin),
// with booking value for scale, broken down by ground and by owner. Admin-only.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [summary, byFacility] = await Promise.all([financeSummary(), financeByFacility()]);

    const owners = new Map<string, { ownerId: string; ownerName: string; ownerEmail: string; facilities: number; bookings: number; bookingValue: number; commission: number; outstanding: number; lobbyMargin: number; goplay: number }>();
    for (const f of byFacility) {
      const o = owners.get(f.ownerId) ?? { ownerId: f.ownerId, ownerName: f.ownerName, ownerEmail: f.ownerEmail, facilities: 0, bookings: 0, bookingValue: 0, commission: 0, outstanding: 0, lobbyMargin: 0, goplay: 0 };
      o.facilities++; o.bookings += f.bookings; o.bookingValue += f.bookingValue;
      o.commission += f.commission; o.outstanding += f.outstanding; o.lobbyMargin += f.lobbyMargin; o.goplay += f.goplay;
      owners.set(f.ownerId, o);
    }
    const r = (n: number) => Math.round(n * 100) / 100;
    const byOwner = [...owners.values()]
      .map((o) => ({ ...o, bookingValue: r(o.bookingValue), commission: r(o.commission), outstanding: r(o.outstanding), lobbyMargin: r(o.lobbyMargin), goplay: r(o.goplay) }))
      .sort((a, b) => b.goplay - a.goplay || b.bookingValue - a.bookingValue);

    return Response.json({ summary, byOwner, byFacility });
  } catch (err) {
    console.error("[GET /api/admin/earnings]", err);
    return Response.json({ error: "Failed to fetch earnings." }, { status: 500 });
  }
}
