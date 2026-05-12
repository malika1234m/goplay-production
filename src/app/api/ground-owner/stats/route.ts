import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true, status: true } } },
    });

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const facilityIds = profile.facilities.map((f) => f.id);
    const activeCount = profile.facilities.filter((f) => f.status === "ACTIVE").length;

    // Monthly revenue (current month)
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalBookings, monthRevenueAgg, reviewStats, todayBookings] = await Promise.all([
      db.facilityBooking.count({
        where: { facilityId: { in: facilityIds }, status: "COMPLETED" },
      }),
      db.facilityBooking.aggregate({
        where: {
          facilityId: { in: facilityIds },
          status: "COMPLETED",
          bookingDate: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      db.facilityReview.aggregate({
        where: { facilityId: { in: facilityIds } },
        _avg:   { rating: true },
        _count: { rating: true },
      }),
      db.facilityBooking.findMany({
        where: {
          facilityId: { in: facilityIds },
          bookingDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt:  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
          },
          status: { in: ["CONFIRMED", "PENDING"] },
        },
        include: {
          user:     { select: { name: true } },
          facility: { select: { name: true } },
          court:    { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const monthlyRevenue = monthRevenueAgg._sum.totalAmount ?? 0;
    const avgRating      = reviewStats._avg.rating
      ? Math.round(reviewStats._avg.rating * 10) / 10
      : null;
    const totalReviews   = reviewStats._count.rating;

    return Response.json({
      stats: {
        monthlyRevenue,
        totalBookings,
        activeGrounds: activeCount,
        totalGrounds: profile.facilities.length,
        avgRating,
        totalReviews,
      },
      todayBookings: todayBookings.map((b) => ({
        id:            b.id,
        userName:      b.user.name,
        facilityName:  b.facility.name,
        courtName:     b.court?.name ?? null,
        startTime:     b.startTime,
        endTime:       b.endTime,
        totalAmount:   b.totalAmount,
        status:        b.status,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
      })),
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/stats]", err);
    return Response.json({ error: "Failed to fetch stats." }, { status: 500 });
  }
}
