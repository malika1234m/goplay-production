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
    const trimmedName = (name ?? "").trim();
    if (!trimmedName || trimmedName.length < 2) return Response.json({ error: "Full name must be at least 2 characters." }, { status: 400 });
    if (trimmedName.length > 50)               return Response.json({ error: "Full name must be under 50 characters." }, { status: 400 });
    if (phone?.trim()) {
      const cleaned = (phone as string).replace(/[\s\-().]/g, "");
      if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) {
        return Response.json({ error: "Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)." }, { status: 400 });
      }
    }
    if (businessName?.trim() && (businessName as string).trim().length > 100) {
      return Response.json({ error: "Business name must be under 100 characters." }, { status: 400 });
    }
    if (bio?.trim() && (bio as string).trim().length > 500) {
      return Response.json({ error: "Bio must be under 500 characters." }, { status: 400 });
    }
    if (address?.trim() && (address as string).trim().length > 200) {
      return Response.json({ error: "Address must be under 200 characters." }, { status: 400 });
    }
    if (city?.trim() && (city as string).trim().length > 50) {
      return Response.json({ error: "City must be under 50 characters." }, { status: 400 });
    }

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
