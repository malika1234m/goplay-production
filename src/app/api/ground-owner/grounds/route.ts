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

    const trimmedName    = (name    ?? "").trim();
    const trimmedAddress = (address ?? "").trim();
    const trimmedCity    = (city    ?? "").trim();

    if (!trimmedName || trimmedName.length < 3)       return Response.json({ error: "Ground name must be at least 3 characters." }, { status: 400 });
    if (trimmedName.length > 100)                     return Response.json({ error: "Ground name must be under 100 characters." }, { status: 400 });
    if (!trimmedAddress || trimmedAddress.length < 5) return Response.json({ error: "Address must be at least 5 characters." }, { status: 400 });
    if (!trimmedCity || trimmedCity.length < 2)       return Response.json({ error: "City must be at least 2 characters." }, { status: 400 });
    if (!categoryId)                                  return Response.json({ error: "Sport category is required." }, { status: 400 });
    const rate = Number(hourlyRate);
    if (!hourlyRate || rate < 1)                      return Response.json({ error: "Hourly rate must be at least Rs. 1." }, { status: 400 });
    if (rate > 100000)                                return Response.json({ error: "Hourly rate cannot exceed Rs. 100,000." }, { status: 400 });
    if (capacity !== undefined && capacity !== null) {
      const cap = Number(capacity);
      if (cap < 1)   return Response.json({ error: "Capacity must be at least 1 player." }, { status: 400 });
      if (cap > 500) return Response.json({ error: "Capacity cannot exceed 500 players." }, { status: 400 });
    }

    const ground = await db.sportsFacility.create({
      data: {
        name:        trimmedName,
        description: description || null,
        address:     trimmedAddress,
        city:        trimmedCity,
        hourlyRate:  rate,
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
