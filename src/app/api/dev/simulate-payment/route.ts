import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notify";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const session = await getSession(req);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "GROUND_OWNER"].includes(session.user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { orderId, statusCode = 2 } = await req.json() as {
      orderId:     string;
      statusCode?: number;
    };

    if (!orderId) {
      return Response.json({ error: "orderId is required." }, { status: 400 });
    }

    const sub = await db.ownerSubscription.findUnique({
      where:   { payHereOrderId: orderId },
      include: {
        owner: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!sub) {
      return Response.json({ error: `No subscription found with orderId "${orderId}".` }, { status: 404 });
    }

    if (sub.status === "PAID") {
      return Response.json({ error: "This order has already been paid." }, { status: 409 });
    }

    const now = new Date();

    if (statusCode === 2) {
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

      } else if (sub.type === "SUBSCRIPTION") {
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
        await createNotification({
          userId:  sub.owner.user.id,
          title:   `${planLabel} Plan Activated`,
          message: `Your ${planLabel} plan is now active until ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
          type:    "success",
        });
      }
    } else if (statusCode === -1 || statusCode === -2) {
      await db.ownerSubscription.update({
        where: { id: sub.id },
        data:  { status: "FAILED" },
      });
    } else {
      return Response.json({ error: `Unsupported statusCode: ${statusCode}. Use 2 (success), -1 (cancelled), or -2 (failed).` }, { status: 400 });
    }

    const updated = await db.ownerSubscription.findUnique({ where: { id: sub.id } });

    return Response.json({
      success:  true,
      message:  `Payment simulated with statusCode=${statusCode}.`,
      subscription: {
        id:            updated!.id,
        orderId:       updated!.payHereOrderId,
        type:          updated!.type,
        plan:          updated!.plan,
        amount:        updated!.amount,
        status:        updated!.status,
        paidAt:        updated!.paidAt?.toISOString() ?? null,
        expiresAt:     updated!.expiresAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    console.error("[POST /api/dev/simulate-payment]", err);
    return Response.json({ error: "Simulation failed." }, { status: 500 });
  }
}
