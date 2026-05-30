import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { getEffectivePlan } from "@/lib/plan";
import { createNotification } from "@/lib/notify";
import { sendPlanCancelledEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { immediate = false } = await req.json() as { immediate?: boolean };

    const profile = await db.groundOwnerProfile.findUnique({
      where:  { userId: session.user.id },
      select: { id: true, plan: true, planExpiresAt: true, isActivated: true },
    });
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
    if (!profile.isActivated) return Response.json({ error: "Account is not activated." }, { status: 400 });

    const effectivePlan = getEffectivePlan(profile);
    if (effectivePlan === "STARTER") {
      return Response.json({ error: "You are already on the free Starter plan. Nothing to cancel." }, { status: 400 });
    }

    const planLabel   = profile.plan === "GROWTH" ? "Growth" : "Pro";
    const expiresAt   = profile.planExpiresAt;
    const expiryStr   = expiresAt
      ? expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;

    if (immediate) {
      // Downgrade to Starter right now
      await db.groundOwnerProfile.update({
        where: { id: profile.id },
        data:  { plan: "STARTER", planExpiresAt: null },
      });

      // Record the cancellation in subscription history
      await db.ownerSubscription.create({
        data: {
          ownerId: profile.id,
          plan:    "STARTER",
          type:    "SUBSCRIPTION",
          amount:  0,
          status:  "PAID",
          paidAt:  new Date(),
          notes:   `Cancelled by owner — immediate downgrade from ${planLabel}`,
        },
      });

      await createNotification({
        userId:  session.user.id,
        title:   "Subscription Cancelled",
        message: `Your ${planLabel} plan has been cancelled. You are now on the Starter plan.`,
        type:    "info",
      });

      void sendPlanCancelledEmail({
        to:        session.user.email ?? "",
        name:      session.user.name  ?? "Owner",
        plan:      planLabel,
        immediate: true,
        expiresAt: null,
      });

      return Response.json({
        message:   `Your ${planLabel} plan has been cancelled. You are now on the Starter plan.`,
        newPlan:   "STARTER",
        immediate: true,
      });

    } else {
      // Let it expire naturally — just mark as cancelled in history
      await db.ownerSubscription.create({
        data: {
          ownerId:  profile.id,
          plan:     profile.plan,
          type:     "SUBSCRIPTION",
          amount:   0,
          status:   "PAID",
          expiresAt: expiresAt ?? undefined,
          paidAt:   new Date(),
          notes:    `Cancellation notice — ${planLabel} plan will not renew after ${expiryStr ?? "expiry"}`,
        },
      });

      await createNotification({
        userId:  session.user.id,
        title:   "Subscription Set to Cancel",
        message: expiryStr
          ? `Your ${planLabel} plan will remain active until ${expiryStr}, then move to Starter automatically.`
          : `Your ${planLabel} plan has been marked for cancellation and will move to Starter at expiry.`,
        type:    "info",
      });

      void sendPlanCancelledEmail({
        to:        session.user.email ?? "",
        name:      session.user.name  ?? "Owner",
        plan:      planLabel,
        immediate: false,
        expiresAt: expiryStr,
      });

      return Response.json({
        message:   expiryStr
          ? `Your ${planLabel} plan will remain active until ${expiryStr}. No further charges.`
          : "Cancellation recorded. Your plan will not renew.",
        newPlan:   effectivePlan,
        immediate: false,
        expiresAt: expiresAt?.toISOString() ?? null,
      });
    }
  } catch (err) {
    console.error("[POST /api/ground-owner/billing/cancel]", err);
    return Response.json({ error: "Failed to cancel subscription." }, { status: 500 });
  }
}
