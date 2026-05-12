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
    const onlyReported = searchParams.get("reported") === "true";

    const where = onlyReported ? { reported: true } : {};

    const reviews = await db.facilityReview.findMany({
      where,
      include: {
        user:     { select: { name: true, email: true } },
        facility: { select: { name: true, city: true } },
        booking:  { select: { bookingDate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const totalReported = await db.facilityReview.count({ where: { reported: true } });

    return Response.json({
      reviews: reviews.map((r) => ({
        id:           r.id,
        rating:       r.rating,
        reviewText:   r.reviewText,
        reported:     r.reported,
        reportReason: r.reportReason,
        createdAt:    r.createdAt,
        userName:     r.user.name,
        userEmail:    r.user.email,
        facilityName: r.facility.name,
        facilityCity: r.facility.city,
        bookingDate:  r.booking.bookingDate,
      })),
      totalReported,
    });
  } catch (err) {
    console.error("[GET /api/admin/reviews]", err);
    return Response.json({ error: "Failed to fetch reviews." }, { status: 500 });
  }
}
