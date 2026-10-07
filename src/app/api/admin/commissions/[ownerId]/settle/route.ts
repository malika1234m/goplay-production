import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { sendCommissionSettledEmail } from "@/lib/email";

// POST /api/admin/commissions/[ownerId]/settle
// Marks every unpaid platform commission for this owner as collected. Owners hold all player
// money (cash and bank transfers), so commission is always paid to GoPlay directly.
export async function POST(req: NextRequest, { params }: { params: Promise<{ ownerId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ownerId } = await params;
    const { note } = await req.json();

    const profile = await db.groundOwnerProfile.findUnique({
      where: { id: ownerId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!profile) return Response.json({ error: "Owner not found." }, { status: 404 });

    const unpaidCash = await db.groundEarning.findMany({
      where: { ownerId, commissionPaid: false, platformFee: { gt: 0 } },
      select: { id: true, platformFee: true },
    });

    if (unpaidCash.length === 0) {
      return Response.json({ error: "No outstanding commissions for this owner." }, { status: 400 });
    }

    const totalCashCommission = unpaidCash.reduce((s, e) => s + e.platformFee, 0);

    // Mark all unpaid cash commissions as settled and clear pending request
    await Promise.all([
      db.groundEarning.updateMany({
        where: { id: { in: unpaidCash.map((e) => e.id) } },
        data: {
          commissionPaid:      true,
          commissionSettledAt: new Date(),
          commissionNote: note?.trim() || "Collected directly.",
        },
      }),
      db.groundOwnerProfile.update({
        where: { id: ownerId },
        data: {
          commissionRequestedAt:     null,
          commissionRequestedAmount: null,
        },
      }),
    ]);

    const amountStr = `Rs. ${Math.round(totalCashCommission).toLocaleString()}`;
    const notifyMsg = `${amountStr} in platform commission has been marked as collected. Thank you!`;

    // Push notification (via createNotification)
    await createNotification({
      userId:  profile.user.id,
      title:   "Commission Settled",
      message: notifyMsg,
      type:    "info",
    });

    // Email (fire-and-forget)
    void sendCommissionSettledEmail({
      to:     profile.user.email,
      name:   profile.user.name ?? "Ground Owner",
      amount: totalCashCommission,
      type:   "direct",
      note:   note?.trim() || undefined,
    });

    return Response.json({
      message: `Rs. ${Math.round(totalCashCommission).toLocaleString()} commission settled.`,
      settled: unpaidCash.length,
    });
  } catch (err) {
    console.error("[POST /api/admin/commissions/[ownerId]/settle]", err);
    return Response.json({ error: "Failed to settle commission." }, { status: 500 });
  }
}
