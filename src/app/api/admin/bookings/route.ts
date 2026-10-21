import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const PER_PAGE = 30;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q      = searchParams.get("q")      ?? "";
    const status = searchParams.get("status") ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
    const method = searchParams.get("payment") ?? "";
    const from   = searchParams.get("from") ?? "";
    const to     = searchParams.get("to")   ?? "";
    const isDay  = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

    const where: Record<string, unknown> = {};

    if (["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) where.status = status;
    if (method === "ONLINE" || method === "ON_ARRIVAL") where.paymentMethod = method;
    if (isDay(from) || isDay(to)) {
      where.bookingDate = { ...(isDay(from) && { gte: new Date(`${from}T00:00:00Z`) }), ...(isDay(to) && { lte: new Date(`${to}T00:00:00Z`) }) };
    }

    const term = q.trim();
    if (term) {
      where.OR = [
        { id:            { startsWith: term } },
        { user:          { name:  { contains: term, mode: "insensitive" } } },
        { user:          { email: { contains: term, mode: "insensitive" } } },
        { contactEmail:  { contains: term, mode: "insensitive" } },
        { contactNumber: { contains: term.replace(/\s+/g, "") } },
        { facility:      { name:  { contains: term, mode: "insensitive" } } },
      ];
    }

    const [bookings, total] = await Promise.all([
      db.facilityBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * PER_PAGE,
        take:  PER_PAGE,
        select: {
          id:            true,
          bookingDate:   true,
          startTime:     true,
          endTime:       true,
          totalAmount:   true,
          totalHours:    true,
          status:        true,
          paymentMethod: true,
          paymentStatus: true,
          createdAt:     true,
          specialRequests: true,
          isOpenMatch:   true,
          noShowReview:  true,
          user:     { select: { id: true, name: true, email: true } },
          facility: { select: { id: true, name: true, city: true } },
          court:    { select: { id: true, name: true } },
        },
      }),
      db.facilityBooking.count({ where }),
    ]);

    const counts = await db.facilityBooking.groupBy({
      by:     ["status"],
      _count: { _all: true },
    });

    const statusCounts = Object.fromEntries(
      counts.map((c) => [c.status, c._count._all])
    );

    return Response.json({
      bookings,
      total,
      page,
      pages: Math.ceil(total / PER_PAGE),
      statusCounts,
    });
  } catch (err) {
    console.error("[GET /api/admin/bookings]", err);
    return Response.json({ error: "Failed to load bookings" }, { status: 500 });
  }
}
