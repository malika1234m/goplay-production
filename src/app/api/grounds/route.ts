import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q        = searchParams.get("q") ?? "";
    const city     = searchParams.get("city") ?? "";
    const category = searchParams.get("category") ?? "";

    const grounds = await db.sportsFacility.findMany({
      where: {
        status: "ACTIVE",
        ...(q    && { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ]}),
        ...(city && { city: { contains: city, mode: "insensitive" } }),
        ...(category && {
          categories: { some: { name: { equals: category, mode: "insensitive" } } },
        }),
      },
      select: {
        id:        true,
        name:      true,
        city:      true,
        address:   true,
        hourlyRate: true,
        capacity:  true,
        amenities: true,
        images:    true,
        categories: { select: { name: true, icon: true } },
        _count:    { select: { reviews: true } },
        reviews:   { select: { rating: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const result = grounds.map((g) => {
      const avgRating = g.reviews.length > 0
        ? g.reviews.reduce((sum, r) => sum + r.rating, 0) / g.reviews.length
        : null;
      return {
        id:          g.id,
        name:        g.name,
        city:        g.city,
        address:     g.address,
        hourlyRate:  g.hourlyRate,
        capacity:    g.capacity,
        amenities:   g.amenities,
        images:      g.images,
        categories:  g.categories,
        avgRating:   avgRating ? Math.round(avgRating * 10) / 10 : null,
        totalReviews: g._count.reviews,
      };
    });

    return Response.json({ grounds: result }, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[GET /api/grounds]", err);
    return Response.json({ error: "Failed to fetch grounds." }, { status: 500 });
  }
}
