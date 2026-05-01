import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [user, bookingStats] = await Promise.all([
      db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
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

    return Response.json({ user, stats });
  } catch (err) {
    console.error("[GET /api/user/profile]", err);
    return Response.json({ error: "Failed to fetch profile." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { name, phone } = await req.json();
    if (!name?.trim()) return Response.json({ error: "Name is required." }, { status: 400 });

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
