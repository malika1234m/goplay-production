import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { FacilityStatus } from "@prisma/client";

const VALID_FACILITY_STATUSES = new Set<string>(Object.values(FacilityStatus));
const PER_PAGE = 25;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q         = searchParams.get("q")      ?? "";
    const statusRaw = searchParams.get("status") ?? "";
    const status    = VALID_FACILITY_STATUSES.has(statusRaw) ? (statusRaw as FacilityStatus) : undefined;
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);

    const where = {
      ...(q      && { OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } },
      ]}),
      ...(status && { status }),
    };

    const [grounds, total, statusCounts] = await Promise.all([
      db.sportsFacility.findMany({
        where,
        include: {
          categories: { select: { name: true } },
          owner: { include: { user: { select: { name: true, email: true } } } },
          _count: { select: { bookings: true, reviews: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
      db.sportsFacility.count({ where }),
      db.sportsFacility.groupBy({ by: ["status"], _count: true }),
    ]);

    const counts = {
      all:      statusCounts.reduce((s, g) => s + g._count, 0),
      active:   statusCounts.find((g) => g.status === "ACTIVE")?._count   ?? 0,
      pending:  statusCounts.find((g) => g.status === "PENDING")?._count  ?? 0,
      inactive: statusCounts.find((g) => g.status === "INACTIVE")?._count ?? 0,
      rejected: statusCounts.find((g) => g.status === "REJECTED")?._count ?? 0,
    };

    return Response.json({
      grounds: grounds.map((g) => ({
        id:            g.id,
        name:          g.name,
        city:          g.city,
        address:       g.address,
        hourlyRate:    g.hourlyRate,
        status:        g.status,
        createdAt:     g.createdAt,
        categories:    g.categories.map((c) => c.name),
        ownerName:     g.owner.user.name,
        ownerEmail:    g.owner.user.email,
        totalBookings: g._count.bookings,
        totalReviews:  g._count.reviews,
      })),
      total,
      page,
      hasMore: page * PER_PAGE < total,
      counts,
    }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
  } catch (err) {
    console.error("[GET /api/admin/grounds]", err);
    return Response.json({ error: "Failed to fetch grounds." }, { status: 500 });
  }
}
