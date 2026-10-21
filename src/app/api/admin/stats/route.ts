import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { financeSummary, lkMonthStart } from "@/lib/admin-finance";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Sri Lanka calendar months — the same periods the finance figures use
    const [monthStart, lastMonth] = [lkMonthStart(0), lkMonthStart(-1)];

    const [totalUsers, newUsersThisMonth, newUsersLastMonth, activeGrounds, pendingGrounds, finance] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: monthStart } } }),
      db.user.count({ where: { createdAt: { gte: lastMonth, lt: monthStart } } }),
      db.sportsFacility.count({ where: { status: "ACTIVE" } }),
      db.sportsFacility.count({ where: { status: "PENDING" } }),
      financeSummary(),
    ]);

    // Booking value comes from financeSummary, so the dashboard and the Earnings page can't disagree
    const totalRevenue  = finance.bookingValue.total;
    const thisMonthRev  = finance.bookingValue.month;
    const revenueChange = finance.bookingValue.change ?? 0;
    const usersChange   = newUsersThisMonth - newUsersLastMonth;

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
      finance,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET /api/admin/stats]", err);
    return Response.json({ error: "Failed to fetch stats." }, { status: 500 });
  }
}
