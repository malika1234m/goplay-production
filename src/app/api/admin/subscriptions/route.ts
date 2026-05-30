import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const now       = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86_400_000);

    const [
      allOwners,
      pendingActivationRows,
      expiringSoonRows,
      expiredRows,
      recentPaymentRows,
      paidRegistrationAgg,
      paidSubscriptionAgg,
    ] = await Promise.all([
      db.groundOwnerProfile.findMany({
        select: { id: true, plan: true, planExpiresAt: true, isActivated: true },
      }),
      db.groundOwnerProfile.findMany({
        where: { isActivated: false },
        select: {
          id:          true,
          businessName: true,
          user:        { select: { id: true, name: true, email: true, createdAt: true } },
        },
        orderBy: { user: { createdAt: "desc" } },
      }),
      db.groundOwnerProfile.findMany({
        where: {
          plan:          { not: "STARTER" },
          planExpiresAt: { gte: now, lte: sevenDays },
          isActivated:   true,
        },
        select: {
          id:           true,
          plan:         true,
          planExpiresAt: true,
          user:         { select: { name: true, email: true } },
        },
      }),
      db.groundOwnerProfile.findMany({
        where: {
          plan:          { not: "STARTER" },
          planExpiresAt: { lt: now },
          isActivated:   true,
        },
        select: {
          id:           true,
          plan:         true,
          planExpiresAt: true,
          user:         { select: { name: true, email: true } },
        },
      }),
      db.ownerSubscription.findMany({
        take:    20,
        orderBy: { createdAt: "desc" },
        include: { owner: { include: { user: { select: { name: true, email: true } } } } },
      }),
      db.ownerSubscription.aggregate({
        where: { type: "REGISTRATION_FEE", status: "PAID" },
        _sum:  { amount: true },
      }),
      db.ownerSubscription.aggregate({
        where: { type: "SUBSCRIPTION", status: "PAID" },
        _sum:  { amount: true },
      }),
    ]);

    // MRR: sum monthlyFee for each active paid-plan owner (non-expired)
    const mrr = allOwners.reduce((acc, o) => {
      if (o.plan === "STARTER") return acc;
      if (o.planExpiresAt && o.planExpiresAt < now) return acc;
      return acc + (PLAN_CONFIG[o.plan as PlanKey].monthlyFee ?? 0);
    }, 0);

    const totalRegistrationFees    = paidRegistrationAgg._sum.amount ?? 0;
    const totalSubscriptionRevenue = paidSubscriptionAgg._sum.amount ?? 0;
    const totalRevenue             = totalRegistrationFees + totalSubscriptionRevenue;

    // Plan distribution
    const activated = allOwners.filter((o) => o.isActivated);
    const totalOwners = allOwners.length;

    const planCounts: Record<PlanKey, number> = { STARTER: 0, GROWTH: 0, PRO: 0 };
    for (const o of activated) {
      const effectivePlan: PlanKey =
        o.plan !== "STARTER" && o.planExpiresAt && o.planExpiresAt < now ? "STARTER" : (o.plan as PlanKey);
      planCounts[effectivePlan]++;
    }

    const activatedCount = activated.length;
    const pct = (n: number) => activatedCount > 0 ? Math.round((n / activatedCount) * 100) : 0;

    const planDistribution = {
      STARTER: {
        count:      planCounts.STARTER,
        percentage: pct(planCounts.STARTER),
      },
      GROWTH: {
        count:      planCounts.GROWTH,
        percentage: pct(planCounts.GROWTH),
        mrr:        planCounts.GROWTH * PLAN_CONFIG.GROWTH.monthlyFee,
      },
      PRO: {
        count:      planCounts.PRO,
        percentage: pct(planCounts.PRO),
        mrr:        planCounts.PRO * PLAN_CONFIG.PRO.monthlyFee,
      },
    };

    const pendingActivations = pendingActivationRows.map((o) => ({
      id:           o.id,
      ownerId:      o.user.id,
      name:         o.user.name,
      email:        o.user.email,
      joinedAt:     o.user.createdAt.toISOString(),
      businessName: o.businessName,
    }));

    const expiringSoon = expiringSoonRows.map((o) => {
      const daysLeft = Math.ceil((o.planExpiresAt!.getTime() - now.getTime()) / 86_400_000);
      return {
        id:           o.id,
        name:         o.user.name,
        email:        o.user.email,
        plan:         o.plan,
        planExpiresAt: o.planExpiresAt!.toISOString(),
        daysLeft,
      };
    });

    const expiredPlans = expiredRows.map((o) => ({
      id:           o.id,
      name:         o.user.name,
      email:        o.user.email,
      plan:         o.plan,
      planExpiresAt: o.planExpiresAt!.toISOString(),
    }));

    const recentPayments = recentPaymentRows.map((s) => ({
      id:           s.id,
      ownerName:    s.owner.user.name,
      ownerEmail:   s.owner.user.email,
      plan:         s.plan,
      type:         s.type,
      amount:       s.amount,
      status:       s.status,
      paidAt:       s.paidAt ? s.paidAt.toISOString() : null,
      createdAt:    s.createdAt.toISOString(),
    }));

    return Response.json({
      revenue: { mrr, totalRegistrationFees, totalSubscriptionRevenue, totalRevenue },
      planDistribution,
      pendingActivations,
      expiringSoon,
      expiredPlans,
      recentPayments,
      totals: {
        owners:      totalOwners,
        activated:   activatedCount,
        unactivated: totalOwners - activatedCount,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/subscriptions]", err);
    return Response.json({ error: "Failed to fetch subscription analytics." }, { status: 500 });
  }
}
