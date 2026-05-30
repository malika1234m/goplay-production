import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPayHereNotify } from "@/lib/payhere";
import { createNotification } from "@/lib/notify";
import { sendPlanActivationEmail, sendPlanUpgradeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();

    const params = {
      merchant_id:      body.get("merchant_id")      as string,
      order_id:         body.get("order_id")         as string,
      payhere_amount:   body.get("payhere_amount")   as string,
      payhere_currency: body.get("payhere_currency") as string,
      status_code:      body.get("status_code")      as string,
      md5sig:           body.get("md5sig")           as string,
    };

    if (Object.values(params).some((v) => !v)) {
      return new Response("Bad Request", { status: 400 });
    }

    if (!verifyPayHereNotify(params)) {
      console.warn("[owner-notify] Invalid signature for order", params.order_id);
      return new Response("Invalid signature", { status: 400 });
    }

    const sub = await db.ownerSubscription.findUnique({
      where:   { payHereOrderId: params.order_id },
      include: { owner: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (!sub) {
      console.warn("[owner-notify] Unknown order_id", params.order_id);
      return new Response("OK", { status: 200 });
    }

    const statusCode = Number(params.status_code);

    if (statusCode === 2) {
      const now = new Date();

      if (sub.type === "REGISTRATION_FEE") {
        await db.$transaction([
          db.ownerSubscription.update({
            where: { id: sub.id },
            data:  { status: "PAID", paidAt: now },
          }),
          db.groundOwnerProfile.update({
            where: { id: sub.ownerId },
            data:  { isActivated: true },
          }),
        ]);

        await createNotification({
          userId:  sub.owner.user.id,
          title:   "Account Activated!",
          message: "Your GoPlay account has been activated. Welcome aboard — you can now access your full dashboard.",
          type:    "success",
        });
        void sendPlanActivationEmail({ to: sub.owner.user.email, name: sub.owner.user.name });

      } else if (sub.type === "SUBSCRIPTION") {
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

        await db.$transaction([
          db.ownerSubscription.update({
            where: { id: sub.id },
            data:  { status: "PAID", paidAt: now, expiresAt },
          }),
          db.groundOwnerProfile.update({
            where: { id: sub.ownerId },
            data:  { plan: sub.plan, planExpiresAt: expiresAt },
          }),
        ]);

        const planLabel = sub.plan === "GROWTH" ? "Growth" : sub.plan === "PRO" ? "Pro" : sub.plan;
        const expiryStr = expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        await createNotification({
          userId:  sub.owner.user.id,
          title:   `${planLabel} Plan Activated`,
          message: `Your ${planLabel} plan is now active until ${expiryStr}.`,
          type:    "success",
        });
        void sendPlanUpgradeEmail({
          to:        sub.owner.user.email,
          name:      sub.owner.user.name,
          plan:      planLabel,
          expiresAt: expiryStr,
          amount:    sub.amount,
        });
      }
    } else if (statusCode === -1 || statusCode === -2) {
      await db.ownerSubscription.update({
        where: { id: sub.id },
        data:  { status: "FAILED" },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[POST /api/payhere/owner-notify]", err);
    return new Response("OK", { status: 200 });
  }
}
