import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const PER_PAGE = 20;

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
    const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const facilityIds = profile.facilities.map((f) => f.id);

    const where: Record<string, unknown> = { facilityId: { in: facilityIds } };
    const ratingNum = rating ? Number(rating) : null;
    if (ratingNum !== null) {
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return Response.json({ error: "Rating filter must be between 1 and 5." }, { status: 400 });
      }
      where.rating = ratingNum;
    }
    if (reportFilter === "yes") where.reported = true;
    if (reportFilter === "no")  where.reported = false;

    const orderBy = sort === "highest"
      ? { rating: "desc" as const }
      : sort === "lowest"
      ? { rating: "asc" as const }
      : { createdAt: "desc" as const };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const baseWhere = { facilityId: { in: facilityIds } };

    // DB-level aggregates replace fetching every review row for stats
    const [reviews, filteredTotal, aggregate, reportedCount, thisWeekCount, ratingGroups] = await Promise.all([
      db.facilityReview.findMany({
        where,
        include: {
          user:     { select: { name: true } },
          facility: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
      db.facilityReview.count({ where }),
      db.facilityReview.aggregate({
        where:  baseWhere,
        _avg:   { rating: true },
        _count: { id: true },
      }),
      db.facilityReview.count({ where: { ...baseWhere, reported: true } }),
      db.facilityReview.count({ where: { ...baseWhere, createdAt: { gte: weekAgo } } }),
      db.facilityReview.groupBy({
        by:    ["rating"],
        where: baseWhere,
        _count: { rating: true },
      }),
    ]);

    const total     = aggregate._count.id;
    const avgRating = aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : null;
    const reported  = reportedCount;
    const thisWeek  = thisWeekCount;
    const dist      = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: ratingGroups.find((g) => g.rating === star)?._count.rating ?? 0,
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
      filteredTotal,
      page,
      hasMore: page * PER_PAGE < filteredTotal,
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("[GET /api/ground-owner/reviews]", err);
    return Response.json({ error: "Failed to fetch reviews." }, { status: 500 });
  }
}
