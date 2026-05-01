import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const now       = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      activeGrounds,
      pendingGrounds,
      allCompleted,
      monthRevenue,
      lastMonthRevenue,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: monthStart } } }),
      db.user.count({ where: { createdAt: { gte: lastMonth, lt: monthStart } } }),
      db.sportsFacility.count({ where: { status: "ACTIVE" } }),
      db.sportsFacility.count({ where: { status: "PENDING" } }),
      db.facilityBooking.findMany({ where: { status: "COMPLETED" }, select: { totalAmount: true } }),
      db.facilityBooking.aggregate({
        where: { status: "COMPLETED", bookingDate: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      db.facilityBooking.aggregate({
        where: { status: "COMPLETED", bookingDate: { gte: lastMonth, lt: monthStart } },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalRevenue    = allCompleted.reduce((s, b) => s + b.totalAmount, 0);
    const thisMonthRev    = monthRevenue._sum.totalAmount ?? 0;
    const lastMonthRev    = lastMonthRevenue._sum.totalAmount ?? 0;
    const revenueChange   = lastMonthRev > 0 ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) : 0;
    const usersChange     = lastMonth > new Date(0) ? newUsersThisMonth - newUsersLastMonth : 0;

    return Response.json({
      stats: {
        totalUsers,
        newUsersThisMonth,
        usersChange,
        totalRevenue,
        monthlyRevenue: thisMonthRev,
        revenueChange,
        activeGrounds,
        pendingGrounds,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/stats]", err);
    return Response.json({ error: "Failed to fetch stats." }, { status: 500 });
  }
}
