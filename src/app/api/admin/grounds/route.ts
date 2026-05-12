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
    const q      = searchParams.get("q")      ?? "";
    const status = searchParams.get("status") ?? "";

    const grounds = await db.sportsFacility.findMany({
      where: {
        ...(q      && { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ]}),
        ...(status && { status: status as "PENDING" | "ACTIVE" | "INACTIVE" | "REJECTED" }),
      },
      include: {
        categories: { select: { name: true } },
        owner: {
          include: { user: { select: { name: true, email: true } } },
        },
        _count: { select: { bookings: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      grounds: grounds.map((g) => ({
        id:         g.id,
        name:       g.name,
        city:       g.city,
        address:    g.address,
        hourlyRate: g.hourlyRate,
        status:     g.status,
        createdAt:  g.createdAt,
        categories: g.categories.map((c) => c.name),
        ownerName:  g.owner.user.name,
        ownerEmail: g.owner.user.email,
        totalBookings: g._count.bookings,
        totalReviews:  g._count.reviews,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/grounds]", err);
    return Response.json({ error: "Failed to fetch grounds." }, { status: 500 });
  }
}
