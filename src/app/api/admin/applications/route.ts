import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ApplicationStatus } from "@prisma/client";

const VALID_APP_STATUSES = new Set<string>(Object.values(ApplicationStatus));

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status") ?? "";
    const q         = searchParams.get("q")      ?? "";
    const status    = VALID_APP_STATUSES.has(statusRaw) ? (statusRaw as ApplicationStatus) : undefined;

    const applications = await db.providerApplication.findMany({
      where: {
        ...(status && { status }),
        ...(q && {
          user: {
            OR: [
              { name:  { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        }),
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with category details
    const allCategoryIds = [...new Set(applications.flatMap((a) => a.categoryIds))];
    const cats = allCategoryIds.length
      ? await db.sportsCategory.findMany({
          where:  { id: { in: allCategoryIds } },
          select: { id: true, name: true, icon: true },
        })
      : [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));

    const enriched = applications.map((a) => ({
      ...a,
      categories: a.categoryIds.map((id) => catMap[id]).filter(Boolean),
    }));

    const all = await db.providerApplication.groupBy({ by: ["status"], _count: true });
    const summary = {
      pending:  all.find((a) => a.status === "PENDING")?._count  ?? 0,
      approved: all.find((a) => a.status === "APPROVED")?._count ?? 0,
      rejected: all.find((a) => a.status === "REJECTED")?._count ?? 0,
    };

    return Response.json({ applications: enriched, summary });
  } catch (err) {
    console.error("[GET /api/admin/applications]", err);
    return Response.json({ error: "Failed to fetch applications." }, { status: 500 });
  }
}
