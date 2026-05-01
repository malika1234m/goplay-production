import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true, email: true, phone: true, createdAt: true,
        groundOwnerProfile: {
          select: {
            id: true, businessName: true, bio: true, address: true, city: true, phone: true,
            facilities: {
              select: {
                status: true,
                _count: { select: { bookings: true, reviews: true } },
              },
            },
          },
        },
      },
    });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const facilities = user.groundOwnerProfile?.facilities ?? [];
    const stats = {
      totalGrounds:    facilities.length,
      activeGrounds:   facilities.filter((f) => f.status === "ACTIVE").length,
      pendingGrounds:  facilities.filter((f) => f.status === "PENDING").length,
      totalBookings:   facilities.reduce((s, f) => s + f._count.bookings, 0),
      totalReviews:    facilities.reduce((s, f) => s + f._count.reviews, 0),
    };

    return Response.json({ user, stats });
  } catch (err) {
    console.error("[GET /api/ground-owner/profile]", err);
    return Response.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, phone, businessName, bio, address, city } = await req.json();
    if (!name?.trim()) return Response.json({ error: "Name is required." }, { status: 400 });

    await db.user.update({
      where: { id: session.user.id },
      data:  { name: name.trim(), phone: phone?.trim() || null },
    });

    await db.groundOwnerProfile.update({
      where: { userId: session.user.id },
      data: {
        businessName: businessName?.trim() || null,
        bio:          bio?.trim()          || null,
        address:      address?.trim()      || null,
        city:         city?.trim()         || null,
        phone:        phone?.trim()        || null,
      },
    });

    return Response.json({ message: "Profile updated." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/profile]", err);
    return Response.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
