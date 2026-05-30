import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { buildPayHereHash, PAYHERE_MERCHANT_ID, PAYHERE_CHECKOUT_URL } from "@/lib/payhere";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";
import { getEffectivePlan } from "@/lib/plan";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { plan } = await req.json() as { plan: PlanKey };

    if (!["GROWTH", "PRO"].includes(plan)) {
      return Response.json({ error: "Invalid plan. Choose GROWTH or PRO." }, { status: 400 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where:   { userId: session.user.id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
    if (!profile.isActivated) return Response.json({ error: "Activate your account before upgrading." }, { status: 400 });

    // Use effective plan (respects expiry) so expired owners can re-subscribe freely
    const effectivePlan = getEffectivePlan(profile);
    if (effectivePlan === plan && profile.planExpiresAt) {
      const daysLeft = (profile.planExpiresAt.getTime() - Date.now()) / 86_400_000;
      if (daysLeft > 7) {
        return Response.json({ error: `Your ${PLAN_CONFIG[plan].label} plan is still active for ${Math.ceil(daysLeft)} more days.` }, { status: 400 });
      }
    }

    const amount  = PLAN_CONFIG[plan].monthlyFee;
    const orderId = `sub_${profile.id}_${Date.now()}`;

    await db.ownerSubscription.create({
      data: {
        ownerId:       profile.id,
        plan:          plan,
        type:          "SUBSCRIPTION",
        amount,
        payHereOrderId: orderId,
        status:        "PENDING",
      },
    });

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const hash    = buildPayHereHash(orderId, amount);
    const [firstName, ...rest] = (profile.user.name ?? "Owner").split(" ");

    const payHereParams = {
      merchant_id:  PAYHERE_MERCHANT_ID,
      return_url:   `${appUrl}/ground-owner/billing?status=success`,
      cancel_url:   `${appUrl}/ground-owner/billing?status=cancelled`,
      notify_url:   `${appUrl}/api/payhere/owner-notify`,
      order_id:     orderId,
      items:        `GoPlay ${PLAN_CONFIG[plan].label} Plan — Monthly Subscription`,
      currency:     "LKR",
      amount:       amount.toFixed(2),
      first_name:   firstName || "Owner",
      last_name:    rest.join(" ") || "-",
      email:        profile.user.email ?? "",
      phone:        profile.user.phone ?? "0771234567",
      address:      profile.address   ?? "N/A",
      city:         profile.city      ?? "N/A",
      country:      "Sri Lanka",
      hash,
      checkout_url: PAYHERE_CHECKOUT_URL,
    };

    return Response.json({ orderId, payHereParams }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/billing/upgrade]", err);
    return Response.json({ error: "Failed to initiate upgrade." }, { status: 500 });
  }
}
