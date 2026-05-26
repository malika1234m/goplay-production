import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { sendCommissionRequestEmail } from "@/lib/email";

// POST /api/admin/commissions/[ownerId]/request
// Sends a commission payment request (push + email) to the ground owner.
// Does NOT mark commissions as paid — use /settle for that.
export async function POST(req: NextRequest, { params }: { params: Promise<{ ownerId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ownerId } = await params;
    const { note } = await req.json().catch(() => ({}));

    const profile = await db.groundOwnerProfile.findUnique({
      where: { id: ownerId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!profile) return Response.json({ error: "Owner not found." }, { status: 404 });

    // Calculate outstanding cash commission
    const unpaidCash = await db.groundEarning.findMany({
      where: { ownerId, paymentMethod: "ON_ARRIVAL", commissionPaid: false },
      select: { platformFee: true },
    });

    if (unpaidCash.length === 0) {
      return Response.json({ error: "No outstanding cash commissions for this owner." }, { status: 400 });
    }

    const totalAmount = unpaidCash.reduce((s, e) => s + e.platformFee, 0);
    const now = new Date();

    // Record the pending request on the owner's profile
    await db.groundOwnerProfile.update({
      where: { id: ownerId },
      data: {
        commissionRequestedAt:     now,
        commissionRequestedAmount: totalAmount,
      },
    });

    const amountStr = `Rs. ${Math.round(totalAmount).toLocaleString()}`;

    // Push notification (via createNotification — also fires push)
    await createNotification({
      userId:  profile.user.id,
      title:   "Commission Payment Request",
      message: `GoPlay admin has requested ${amountStr} in platform commission from your cash bookings. Please arrange payment.`,
      type:    "warning",
      link:    "/(owner)/earnings/payouts",
    });

    // Email (fire-and-forget)
    void sendCommissionRequestEmail({
      to:     profile.user.email,
      name:   profile.user.name ?? "Ground Owner",
      amount: totalAmount,
      note:   note?.trim() || undefined,
    });

    return Response.json({
      message: `Commission request of ${amountStr} sent to ${profile.user.name}.`,
      amount:  totalAmount,
    });
  } catch (err) {
    console.error("[POST /api/admin/commissions/[ownerId]/request]", err);
    return Response.json({ error: "Failed to send commission request." }, { status: 500 });
  }
}
