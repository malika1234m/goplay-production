import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // All completed bookings with facility + owner info
    const bookings = await db.facilityBooking.findMany({
      where: { status: "COMPLETED" },
      select: {
        totalAmount: true,
        bookingDate: true,
        facility: {
          select: {
            id:         true,
            name:       true,
            city:       true,
            hourlyRate: true,
            owner: {
              select: {
                id:   true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    // ── Platform summary ─────────────────────────────────────────────────
    const totalRevenue   = bookings.reduce((s, b) => s + b.totalAmount, 0);
    const monthlyRevenue = bookings
      .filter((b) => new Date(b.bookingDate) >= monthStart)
      .reduce((s, b) => s + b.totalAmount, 0);
    const totalBookings  = bookings.length;
    const avgPerBooking  = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // ── Per-owner aggregation ─────────────────────────────────────────────
    const ownerMap = new Map<string, {
      ownerId:    string;
      ownerName:  string;
      ownerEmail: string;
      revenue:    number;
      bookings:   number;
      facilities: Set<string>;
    }>();

    for (const b of bookings) {
      const { owner } = b.facility;
      const existing  = ownerMap.get(owner.id);
      if (existing) {
        existing.revenue  += b.totalAmount;
        existing.bookings += 1;
        existing.facilities.add(b.facility.id);
      } else {
        ownerMap.set(owner.id, {
          ownerId:    owner.id,
          ownerName:  owner.user.name,
          ownerEmail: owner.user.email,
          revenue:    b.totalAmount,
          bookings:   1,
          facilities: new Set([b.facility.id]),
        });
      }
    }

    const byOwner = Array.from(ownerMap.values())
      .map((o) => ({
        ownerId:         o.ownerId,
        ownerName:       o.ownerName,
        ownerEmail:      o.ownerEmail,
        totalRevenue:    o.revenue,
        totalBookings:   o.bookings,
        facilityCount:   o.facilities.size,
        revenueShare:    totalRevenue > 0 ? Math.round((o.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // ── Per-facility aggregation ──────────────────────────────────────────
    const facilityMap = new Map<string, {
      facilityId:   string;
      facilityName: string;
      city:         string;
      ownerName:    string;
      revenue:      number;
      bookings:     number;
    }>();

    for (const b of bookings) {
      const { id, name, city, owner } = b.facility;
      const existing = facilityMap.get(id);
      if (existing) {
        existing.revenue  += b.totalAmount;
        existing.bookings += 1;
      } else {
        facilityMap.set(id, {
          facilityId:   id,
          facilityName: name,
          city,
          ownerName:    owner.user.name,
          revenue:      b.totalAmount,
          bookings:     1,
        });
      }
    }

    const byFacility = Array.from(facilityMap.values())
      .map((f) => ({
        ...f,
        avgPerBooking:  f.bookings > 0 ? Math.round(f.revenue / f.bookings) : 0,
        revenueShare:   totalRevenue > 0 ? Math.round((f.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return Response.json({
      summary: { totalRevenue, monthlyRevenue, totalBookings, avgPerBooking: Math.round(avgPerBooking) },
      byOwner,
      byFacility,
    });
  } catch (err) {
    console.error("[GET /api/admin/earnings]", err);
    return Response.json({ error: "Failed to fetch earnings." }, { status: 500 });
  }
}
