import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";
import { createNotification } from "@/lib/notify";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ ownerId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ownerId } = await params;
    const { plan, expiresAt, forceActivate, deactivate, notes } = await req.json() as {
      plan?:          PlanKey;
      expiresAt?:     string;
      forceActivate?: boolean;
      deactivate?:    boolean;
      notes?:         string;
    };

    // Prevent conflicting flags
    if (forceActivate && deactivate) {
      return Response.json({ error: "Cannot set forceActivate and deactivate at the same time." }, { status: 400 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where:   { id: ownerId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!profile) return Response.json({ error: "Owner not found." }, { status: 404 });

    const updateData: Record<string, unknown> = {};

    if (plan && ["STARTER", "GROWTH", "PRO"].includes(plan)) {
      updateData.plan = plan;
      if (plan === "STARTER") {
        updateData.planExpiresAt = null;
      } else if (expiresAt) {
        updateData.planExpiresAt = new Date(expiresAt);
      } else {
        updateData.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    if (forceActivate) updateData.isActivated = true;
    if (deactivate)    updateData.isActivated = false;

    await db.groundOwnerProfile.update({ where: { id: ownerId }, data: updateData });

    // Record manual override in subscriptions if a paid plan was set
    if (plan && plan !== "STARTER") {
      await db.ownerSubscription.create({
        data: {
          ownerId,
          plan,
          type:      "SUBSCRIPTION",
          amount:    0,
          status:    "PAID",
          paidAt:    new Date(),
          expiresAt: updateData.planExpiresAt as Date | undefined,
          notes:     notes?.trim() || `Manual override by admin (${session.user.email})`,
        },
      });
    }

    // Notifications
    if (plan) {
      await createNotification({
        userId:  profile.user.id,
        title:   `Plan Updated to ${PLAN_CONFIG[plan].label}`,
        message: plan === "STARTER"
          ? "Your plan has been updated to Starter by the GoPlay team."
          : `Your plan has been upgraded to ${PLAN_CONFIG[plan].label} by the GoPlay team. Enjoy your new features!`,
        type: "success",
      });
    }
    if (forceActivate) {
      await createNotification({
        userId:  profile.user.id,
        title:   "Account Activated",
        message: "Your GoPlay account has been activated by the admin. Welcome aboard!",
        type:    "success",
      });
    }
    if (deactivate) {
      await createNotification({
        userId:  profile.user.id,
        title:   "Account Deactivated",
        message: "Your GoPlay account has been deactivated by the admin. Please contact support for assistance.",
        type:    "error",
      });
    }

    return Response.json({ message: "Owner plan updated successfully." });
  } catch (err) {
    console.error("[PUT /api/admin/owners/:ownerId/plan]", err);
    return Response.json({ error: "Failed to update plan." }, { status: 500 });
  }
}
