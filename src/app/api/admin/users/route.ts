import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";

const VALID_ROLES = new Set<string>(Object.values(Role));
const PER_PAGE = 25;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q       = searchParams.get("q")    ?? "";
    const roleRaw = searchParams.get("role") ?? "";
    const role    = VALID_ROLES.has(roleRaw) ? (roleRaw as Role) : undefined;
    const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);

    const where = {
      ...(q    && { OR: [
        { name:  { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ]}),
      ...(role && { role }),
    };

    const [users, total, roleCounts] = await Promise.all([
      db.user.findMany({
        where,
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
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
      db.user.count({ where }),
      db.user.groupBy({ by: ["role"], _count: true }),
    ]);

    const counts = {
      all:    roleCounts.reduce((s, r) => s + r._count, 0),
      users:  roleCounts.find((r) => r.role === "USER")?._count          ?? 0,
      owners: roleCounts.find((r) => r.role === "GROUND_OWNER")?._count  ?? 0,
      admins: roleCounts.find((r) => r.role === "ADMIN")?._count         ?? 0,
    };

    return Response.json({
      users: users.map((u) => ({
        id:            u.id,
        name:          u.name,
        email:         u.email,
        phone:         u.phone,
        role:          u.role,
        isActive:      u.isActive,
        createdAt:     u.createdAt,
        totalBookings: u._count.bookings,
      })),
      total,
      page,
      hasMore: page * PER_PAGE < total,
      counts,
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return Response.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}
