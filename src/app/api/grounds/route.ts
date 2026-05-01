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
        ...(q    && { name: { contains: q, mode: "insensitive" } }),
        ...(city && { city: { contains: city, mode: "insensitive" } }),
        ...(category && { category: { name: { equals: category, mode: "insensitive" } } }),
      },
      include: {
        category: true,
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = grounds.map((g) => {
      const avgRating =
        g.reviews.length > 0
          ? g.reviews.reduce((sum, r) => sum + r.rating, 0) / g.reviews.length
          : null;
      return {
        id: g.id,
        name: g.name,
        city: g.city,
        address: g.address,
        hourlyRate: g.hourlyRate,
        capacity: g.capacity,
        amenities: g.amenities,
        images: g.images,
        category: g.category.name,
        categoryIcon: g.category.icon,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        totalReviews: g.reviews.length,
      };
    });

    return Response.json({ grounds: result });
  } catch (err) {
    console.error("[GET /api/grounds]", err);
    return Response.json({ error: "Failed to fetch grounds." }, { status: 500 });
  }
}
