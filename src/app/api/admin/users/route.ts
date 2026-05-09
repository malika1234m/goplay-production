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
    const q    = searchParams.get("q") ?? "";
    const role = searchParams.get("role") ?? "";

    const users = await db.user.findMany({
      where: {
        ...(q    && { OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ]}),
        ...(role && { role: role as "USER" | "GROUND_OWNER" | "ADMIN" }),
      },
      select: {
        id:        true,
        name:      true,
        email:     true,
        phone:     true,
        role:      true,
        isActive:  true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      users: users.map((u) => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        phone:     u.phone,
        role:      u.role,
        isActive:  u.isActive,
        createdAt: u.createdAt,
        totalBookings: u._count.bookings,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return Response.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}
