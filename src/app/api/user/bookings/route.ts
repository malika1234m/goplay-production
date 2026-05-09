import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const bookings = await db.facilityBooking.findMany({
      where: {
        userId: session.user.id,
        ...(status && { status: status as any }),
      },
      include: {
        facility: {
          select: { name: true, city: true, address: true, category: { select: { name: true, icon: true } } },
        },
        court:  { select: { name: true } },
        review: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Stats
    const all = await db.facilityBooking.findMany({
      where: { userId: session.user.id },
      select: { status: true },
    });

    const stats = {
      total:     all.length,
      upcoming:  all.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING").length,
      completed: all.filter((b) => b.status === "COMPLETED").length,
      cancelled: all.filter((b) => b.status === "CANCELLED").length,
    };

    const mapped = bookings.map(({ review, ...b }) => ({ ...b, hasReview: !!review }));
    return Response.json({ bookings: mapped, stats });
  } catch (err) {
    console.error("[GET /api/user/bookings]", err);
    return Response.json({ error: "Failed to fetch bookings." }, { status: 500 });
  }
}
