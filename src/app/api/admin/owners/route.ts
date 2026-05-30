import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getEffectivePlan } from "@/lib/plan";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q           = searchParams.get("q")?.trim() ?? "";
    const planFilter  = searchParams.get("plan") ?? "";
    const page        = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit       = 20;

    const profiles = await db.groundOwnerProfile.findMany({
      where: {
        ...(planFilter ? { plan: planFilter as "STARTER" | "GROWTH" | "PRO" } : {}),
        ...(q ? {
          OR: [
            { user:       { name:  { contains: q, mode: "insensitive" } } },
            { user:       { email: { contains: q, mode: "insensitive" } } },
            { businessName: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        user:          { select: { id: true, name: true, email: true, createdAt: true } },
        _count:        { select: { facilities: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { user: { createdAt: "desc" } },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    const total = await db.groundOwnerProfile.count({
      where: {
        ...(planFilter ? { plan: planFilter as "STARTER" | "GROWTH" | "PRO" } : {}),
        ...(q ? {
          OR: [
            { user:         { name:  { contains: q, mode: "insensitive" } } },
            { user:         { email: { contains: q, mode: "insensitive" } } },
            { businessName: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },
    });

    const owners = profiles.map((p) => ({
      id:             p.id,
      userId:         p.user.id,
      name:           p.user.name,
      email:          p.user.email,
      businessName:   p.businessName,
      isActivated:    p.isActivated,
      plan:           p.plan,
      effectivePlan:  getEffectivePlan(p as { plan: "STARTER" | "GROWTH" | "PRO"; planExpiresAt: Date | null }),
      planExpiresAt:  p.planExpiresAt,
      facilityCount:  p._count.facilities,
      joinedAt:       p.user.createdAt,
      lastPayment:    p.subscriptions[0] ?? null,
    }));

    return Response.json({ owners, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[GET /api/admin/owners]", err);
    return Response.json({ error: "Failed to fetch owners." }, { status: 500 });
  }
}
