import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { BookingStatus } from "@prisma/client";

const VALID_BOOKING_STATUSES = new Set<string>(Object.values(BookingStatus));

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status");
    const status    = statusRaw && VALID_BOOKING_STATUSES.has(statusRaw) ? (statusRaw as BookingStatus) : undefined;

    const [bookings, statusCounts] = await Promise.all([
      db.facilityBooking.findMany({
        where: {
          userId: session.user.id,
          ...(status && { status }),
        },
        include: {
          facility: {
            select: {
              name: true, city: true, address: true,
              categories: { select: { name: true, icon: true } },
            },
          },
          court:  { select: { name: true } },
          review: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.facilityBooking.groupBy({
        by:     ["status"],
        where:  { userId: session.user.id },
        _count: true,
      }),
    ]);

    const count = (s: string) =>
      statusCounts.find((g) => g.status === s)?._count ?? 0;

    const stats = {
      total:     statusCounts.reduce((sum, g) => sum + g._count, 0),
      upcoming:  count("CONFIRMED") + count("PENDING"),
      completed: count("COMPLETED"),
      cancelled: count("CANCELLED"),
    };

    const mapped = bookings.map(({ review, ...b }) => ({ ...b, hasReview: !!review }));
    return Response.json({ bookings: mapped, stats });
  } catch (err) {
    console.error("[GET /api/user/bookings]", err);
    return Response.json({ error: "Failed to fetch bookings." }, { status: 500 });
  }
}
