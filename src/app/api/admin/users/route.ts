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
    const state   = searchParams.get("state") ?? ""; // "active" | "inactive"
    const term    = q.trim();

    const where = {
      ...(term && { OR: [
        { name:  { contains: term, mode: "insensitive" as const } },
        { email: { contains: term, mode: "insensitive" as const } },
        { phone: { contains: term.replace(/\s+/g, "") } },
      ]}),
      ...(role && { role }),
      ...(state === "active" && { isActive: true }),
      ...(state === "inactive" && { isActive: false }),
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
    const inactive = await db.user.count({ where: { isActive: false } });

    const counts = {
      all:    roleCounts.reduce((s, r) => s + r._count, 0),
      users:  roleCounts.find((r) => r.role === "USER")?._count          ?? 0,
      owners: roleCounts.find((r) => r.role === "GROUND_OWNER")?._count  ?? 0,
      admins: roleCounts.find((r) => r.role === "ADMIN")?._count         ?? 0,
      workers: roleCounts.find((r) => r.role === "GROUND_WORKER")?._count ?? 0,
      inactive,
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
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return Response.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}
