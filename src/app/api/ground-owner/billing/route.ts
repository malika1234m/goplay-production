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
      where:   { userId: session.user.id },
      select:  { id: true, plan: true, planExpiresAt: true, isActivated: true },
    });
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });

    const effectivePlan = getEffectivePlan(profile as { plan: "STARTER" | "GROWTH" | "PRO"; planExpiresAt: Date | null });

    const subscriptions = await db.ownerSubscription.findMany({
      where:   { ownerId: profile.id },
      orderBy: { createdAt: "desc" },
      take:    10,
    });

    return Response.json({
      plan:          effectivePlan,
      storedPlan:    profile.plan,
      planExpiresAt: profile.planExpiresAt,
      isActivated:   profile.isActivated,
      planConfig:    PLAN_CONFIG[effectivePlan],
      subscriptions: subscriptions.map((s) => ({
        id:            s.id,
        plan:          s.plan,
        type:          s.type,
        amount:        s.amount,
        status:        s.status,
        paidAt:        s.paidAt,
        expiresAt:     s.expiresAt,
        createdAt:     s.createdAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/billing]", err);
    return Response.json({ error: "Failed to fetch billing info." }, { status: 500 });
  }
}
