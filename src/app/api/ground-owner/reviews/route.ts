import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rating       = searchParams.get("rating");
    const reportFilter = searchParams.get("reported"); // "yes" | "no"
    const sort         = searchParams.get("sort") ?? "newest";

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const facilityIds = profile.facilities.map((f) => f.id);

    const where: Record<string, unknown> = { facilityId: { in: facilityIds } };
    if (rating)              where.rating   = Number(rating);
    if (reportFilter === "yes") where.reported = true;
    if (reportFilter === "no")  where.reported = false;

    const orderBy = sort === "highest"
      ? { rating: "desc" as const }
      : sort === "lowest"
      ? { rating: "asc" as const }
      : { createdAt: "desc" as const };

    const [reviews, allReviews] = await Promise.all([
      db.facilityReview.findMany({
        where,
        include: {
          user:     { select: { name: true } },
          facility: { select: { name: true } },
        },
        orderBy,
      }),
      db.facilityReview.findMany({
        where: { facilityId: { in: facilityIds } },
        select: { rating: true, createdAt: true, reported: true },
      }),
    ]);

    const total     = allReviews.length;
    const avgRating = total > 0 ? allReviews.reduce((s, r) => s + r.rating, 0) / total : null;
    const reported  = allReviews.filter((r) => r.reported).length;
    const weekAgo   = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek  = allReviews.filter((r) => new Date(r.createdAt) >= weekAgo).length;
    const dist      = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: allReviews.filter((r) => r.rating === star).length,
    }));

    return Response.json({
      stats: {
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        total,
        reported,
        thisWeek,
        distribution: dist,
      },
      reviews: reviews.map((r) => ({
        id:           r.id,
        rating:       r.rating,
        reviewText:   r.reviewText,
        reported:     r.reported,
        reportReason: r.reportReason,
        createdAt:    r.createdAt,
        userName:     r.user.name,
        facilityName: r.facility.name,
      })),
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/reviews]", err);
    return Response.json({ error: "Failed to fetch reviews." }, { status: 500 });
  }
}
