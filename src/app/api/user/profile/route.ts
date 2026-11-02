import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [user, bookingStats] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        // requiresOnlinePayment: after repeated no-shows, only "Pay online" is offered
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, requiresOnlinePayment: true },
      }),
      db.facilityBooking.groupBy({
        by: ["status"],
        where: { userId: session.user.id },
        _count: true,
      }),
    ]);
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const stats = {
      total:     bookingStats.reduce((s, b) => s + b._count, 0),
      upcoming:  bookingStats.filter((b) => b.status === "CONFIRMED" || b.status === "PENDING").reduce((s, b) => s + b._count, 0),
      completed: bookingStats.find((b) => b.status === "COMPLETED")?._count ?? 0,
      cancelled: bookingStats.find((b) => b.status === "CANCELLED")?._count ?? 0,
    };

    // No caching: the profile changes from other screens (edit profile, a phone saved
    // while joining a lobby), and mobile HTTP caches would keep serving the old copy.
    return Response.json({ user, stats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[GET /api/user/profile]", err);
    return Response.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { name, phone } = await req.json();
    if (!name?.trim()) return Response.json({ error: "Name is required." }, { status: 400 });
    if (name.trim().length < 2 || name.trim().length > 50) {
      return Response.json({ error: "Name must be between 2 and 50 characters." }, { status: 400 });
    }
    // Same rule as registration: grounds use this number to reach the player
    if (phone?.trim() && !/^(?:\+94|0)7[0-9]{8}$/.test(phone.replace(/[\s\-().]/g, ""))) {
      return Response.json({ error: "Enter a valid Sri Lankan mobile number." }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data:  { name: name.trim(), phone: phone?.trim() || null },
      select: { id: true, name: true, email: true, phone: true },
    });

    return Response.json({ user, message: "Profile updated." });
  } catch (err) {
    console.error("[PUT /api/user/profile]", err);
    return Response.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
