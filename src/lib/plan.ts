import { db } from "@/lib/db";
export { REGISTRATION_FEE, PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";

export function getEffectivePlan(profile: { plan: PlanKey; planExpiresAt: Date | null }): PlanKey {
  if (profile.plan === "STARTER") return "STARTER";
  if (profile.planExpiresAt && profile.planExpiresAt < new Date()) return "STARTER";
  return profile.plan;
}

export function getCommissionRate(plan: PlanKey): number {
  return PLAN_CONFIG[plan].commissionPct / 100;
}

export async function canAddFacility(ownerId: string, plan: PlanKey): Promise<{ allowed: boolean; reason?: string }> {
  const max = PLAN_CONFIG[plan].maxFacilities;
  if (max === null) return { allowed: true };
  const count = await db.sportsFacility.count({ where: { ownerId } });
  if (count >= max) {
    return {
      allowed: false,
      reason:  `Your ${PLAN_CONFIG[plan].label} plan allows a maximum of ${max} facilit${max === 1 ? "y" : "ies"}. Upgrade your plan to add more.`,
    };
  }
  return { allowed: true };
}

export async function canAddCourt(facilityId: string, plan: PlanKey): Promise<{ allowed: boolean; reason?: string }> {
  const max = PLAN_CONFIG[plan].maxCourtsPerFacility;
  if (max === null) return { allowed: true };
  const count = await db.facilityCourt.count({ where: { facilityId } });
  if (count >= max) {
    return {
      allowed: false,
      reason:  `Your ${PLAN_CONFIG[plan].label} plan allows a maximum of ${max} courts per facility. Upgrade your plan to add more.`,
    };
  }
  return { allowed: true };
}

export async function canAddWorker(ownerId: string, plan: PlanKey): Promise<{ allowed: boolean; reason?: string }> {
  const max = PLAN_CONFIG[plan].maxWorkers;
  if (max === null) return { allowed: true };
  const count = await db.facilityWorker.count({
    where: { facility: { ownerId } },
  });
  if (count >= max) {
    return {
      allowed: false,
      reason:  `Your ${PLAN_CONFIG[plan].label} plan allows a maximum of ${max} worker${max === 1 ? "" : "s"}. Upgrade your plan to add more.`,
    };
  }
  return { allowed: true };
}

export async function canAddBlockedDate(ownerId: string, plan: PlanKey): Promise<{ allowed: boolean; reason?: string }> {
  const max = PLAN_CONFIG[plan].maxBlockedDatesPerMonth;
  if (max === null) return { allowed: true };
  const now          = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNext  = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const count = await db.blockedDate.count({
    where: {
      facility: { ownerId },
      date:     { gte: startOfMonth, lt: startOfNext },
    },
  });
  if (count >= max) {
    return {
      allowed: false,
      reason:  `Your ${PLAN_CONFIG[plan].label} plan allows a maximum of ${max} blocked dates per month. Upgrade your plan to add more.`,
    };
  }
  return { allowed: true };
}
