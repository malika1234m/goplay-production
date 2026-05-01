import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const grounds = await db.sportsFacility.findMany({
      where: { ownerId: profile.id },
      include: {
        category: true,
        reviews: { select: { rating: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = grounds.map((g) => ({
      id:            g.id,
      name:          g.name,
      city:          g.city,
      address:       g.address,
      hourlyRate:    g.hourlyRate,
      capacity:      g.capacity,
      status:        g.status,
      images:        g.images,
      category:      g.category.name,
      categoryIcon:  g.category.icon,
      totalBookings: g._count.bookings,
      avgRating:     g.reviews.length > 0
        ? Math.round((g.reviews.reduce((s, r) => s + r.rating, 0) / g.reviews.length) * 10) / 10
        : null,
      totalReviews:  g.reviews.length,
    }));

    return Response.json({ grounds: result });
  } catch (err) {
    console.error("[GET /api/ground-owner/grounds]", err);
    return Response.json({ error: "Failed to fetch grounds." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const { name, description, address, city, hourlyRate, capacity, amenities, categoryId, images } = await req.json();

    if (!name || !address || !city || !hourlyRate || !categoryId) {
      return Response.json({ error: "name, address, city, hourlyRate and categoryId are required." }, { status: 400 });
    }

    const ground = await db.sportsFacility.create({
      data: {
        name,
        description: description || null,
        address,
        city,
        hourlyRate: Number(hourlyRate),
        capacity: capacity ? Number(capacity) : null,
        amenities: amenities || [],
        images:    Array.isArray(images) ? images : [],
        status:    "PENDING",
        categoryId,
        ownerId:   profile.id,
      },
    });

    // Default availability Mon–Sun 06:00–22:00
    await db.facilityAvailability.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        facilityId: ground.id,
        dayOfWeek: day,
        openTime: "06:00",
        closeTime: "22:00",
        isOpen: true,
      })),
    });

    return Response.json({ ground, message: "Ground submitted for admin approval." }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/grounds]", err);
    return Response.json({ error: "Failed to create ground." }, { status: 500 });
  }
}
