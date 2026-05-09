import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const ground = await db.sportsFacility.findUnique({
      where: { id, status: "ACTIVE" },
      include: {
        category: true,
        availability: { orderBy: { dayOfWeek: "asc" } },
        courts: {
          where:   { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select:  { id: true, name: true, description: true },
        },
        reviews: {
          include: { user: { select: { name: true } }, reply: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        owner: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!ground) {
      return Response.json({ error: "Ground not found." }, { status: 404 });
    }

    const avgRating =
      ground.reviews.length > 0
        ? ground.reviews.reduce((sum, r) => sum + r.rating, 0) / ground.reviews.length
        : null;

    return Response.json({
      ground: {
        id: ground.id,
        name: ground.name,
        description: ground.description,
        address: ground.address,
        city: ground.city,
        hourlyRate: ground.hourlyRate,
        capacity: ground.capacity,
        amenities: ground.amenities,
        images: ground.images,
        category: ground.category.name,
        categoryIcon: ground.category.icon,
        courts: ground.courts,
        availability: ground.availability,
        reviews: ground.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          reviewText: r.reviewText,
          createdAt: r.createdAt,
          userName: r.user.name,
          reply: r.reply?.reply ?? null,
        })),
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        totalReviews: ground.reviews.length,
        ownerName: ground.owner.user.name,
      },
    });
  } catch (err) {
    console.error("[GET /api/grounds/:id]", err);
    return Response.json({ error: "Failed to fetch ground." }, { status: 500 });
  }
}
