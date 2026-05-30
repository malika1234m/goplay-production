import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { getEffectivePlan } from "@/lib/plan";
import { PLAN_CONFIG } from "@/lib/plan-constants";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where:  { userId: session.user.id },
      select: { id: true, plan: true, planExpiresAt: true, isActivated: true },
    });
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });

    const effectivePlan = getEffectivePlan(profile as { plan: "STARTER" | "GROWTH" | "PRO"; planExpiresAt: Date | null });
    const config = PLAN_CONFIG[effectivePlan];

    const now           = new Date();
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNext   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [facilityCount, workerCount, blockedDateCount] = await Promise.all([
      db.sportsFacility.count({ where: { ownerId: profile.id } }),
      db.facilityWorker.count({ where: { facility: { ownerId: profile.id } } }),
      db.blockedDate.count({
        where: {
          facility: { ownerId: profile.id },
          date: { gte: startOfMonth, lt: startOfNext },
        },
      }),
    ]);

    let daysLeft: number | null = null;
    if (effectivePlan !== "STARTER" && profile.planExpiresAt) {
      daysLeft = Math.ceil((profile.planExpiresAt.getTime() - now.getTime()) / 86_400_000);
    }

    const expiringSoon = daysLeft !== null && daysLeft <= 7;

    return Response.json({
      plan:          effectivePlan,
      isActivated:   profile.isActivated,
      planExpiresAt: profile.planExpiresAt ? profile.planExpiresAt.toISOString() : null,
      daysLeft,
      expiringSoon,
      usage: {
        facilities:   { used: facilityCount,    max: config.maxFacilities },
        workers:      { used: workerCount,       max: config.maxWorkers },
        blockedDates: { used: blockedDateCount,  max: config.maxBlockedDatesPerMonth },
      },
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/plan-status]", err);
    return Response.json({ error: "Failed to fetch plan status." }, { status: 500 });
  }
}
