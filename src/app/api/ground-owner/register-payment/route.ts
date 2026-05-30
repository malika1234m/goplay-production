import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { buildPayHereHash, PAYHERE_MERCHANT_ID, PAYHERE_CHECKOUT_URL } from "@/lib/payhere";
import { REGISTRATION_FEE } from "@/lib/plan-constants";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where:   { userId: session.user.id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
    if (profile.isActivated) return Response.json({ error: "Account is already activated." }, { status: 400 });

    // Cancel any stale pending registration payments older than 30 min
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    await db.ownerSubscription.updateMany({
      where: { ownerId: profile.id, type: "REGISTRATION_FEE", status: "PENDING", createdAt: { lt: cutoff } },
      data:  { status: "FAILED", notes: "Expired — new session started." },
    });

    // Prevent duplicate active session
    const active = await db.ownerSubscription.findFirst({
      where: { ownerId: profile.id, type: "REGISTRATION_FEE", status: "PENDING", createdAt: { gte: cutoff } },
    });
    if (active?.payHereOrderId) {
      return Response.json({ orderId: active.payHereOrderId, payHereParams: buildParams(active.payHereOrderId, profile) });
    }

    const orderId = `reg_${profile.id}_${Date.now()}`;

    await db.ownerSubscription.create({
      data: {
        ownerId:       profile.id,
        plan:          "STARTER",
        type:          "REGISTRATION_FEE",
        amount:        REGISTRATION_FEE,
        payHereOrderId: orderId,
        status:        "PENDING",
      },
    });

    return Response.json({ orderId, payHereParams: buildParams(orderId, profile) });
  } catch (err) {
    console.error("[POST /api/ground-owner/register-payment]", err);
    return Response.json({ error: "Failed to initiate payment." }, { status: 500 });
  }
}

function buildParams(orderId: string, profile: { user: { name: string; email: string; phone: string | null }; address: string | null; city: string | null }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hash   = buildPayHereHash(orderId, REGISTRATION_FEE);
  const [firstName, ...rest] = (profile.user.name ?? "Owner").split(" ");
  return {
    merchant_id:  PAYHERE_MERCHANT_ID,
    return_url:   `${appUrl}/ground-owner/activate?status=success`,
    cancel_url:   `${appUrl}/ground-owner/activate?status=cancelled`,
    notify_url:   `${appUrl}/api/payhere/owner-notify`,
    order_id:     orderId,
    items:        "GoPlay Account Activation Fee",
    currency:     "LKR",
    amount:       REGISTRATION_FEE.toFixed(2),
    first_name:   firstName || "Owner",
    last_name:    rest.join(" ") || "-",
    email:        profile.user.email ?? "",
    phone:        profile.user.phone ?? "0771234567",
    address:      profile.address ?? "N/A",
    city:         profile.city    ?? "N/A",
    country:      "Sri Lanka",
    hash,
    checkout_url: PAYHERE_CHECKOUT_URL,
  };
}
