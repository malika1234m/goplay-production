import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { sendCommissionSettledEmail } from "@/lib/email";

// POST /api/admin/commissions/[ownerId]/settle
// type: "direct"  — owner paid commission separately (cash/transfer outside platform)
// type: "net"     — deduct from the online balance admin holds for this owner
export async function POST(req: NextRequest, { params }: { params: Promise<{ ownerId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ownerId } = await params;
    const { type, note } = await req.json();

    if (!["direct", "net"].includes(type)) {
      return Response.json({ error: "type must be 'direct' or 'net'." }, { status: 400 });
    }

    const profile = await db.groundOwnerProfile.findUnique({
      where: { id: ownerId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!profile) return Response.json({ error: "Owner not found." }, { status: 404 });

    // Find all unpaid CASH commissions for this owner
    const unpaidCash = await db.groundEarning.findMany({
      where: { ownerId, paymentMethod: "ON_ARRIVAL", commissionPaid: false },
      select: { id: true, platformFee: true },
    });

    if (unpaidCash.length === 0) {
      return Response.json({ error: "No outstanding cash commissions for this owner." }, { status: 400 });
    }

    const totalCashCommission = unpaidCash.reduce((s, e) => s + e.platformFee, 0);

    if (type === "net") {
      // Verify admin holds enough online money
      const onlineEarnings = await db.groundEarning.findMany({
        where: { ownerId, paymentMethod: "ONLINE", cashConfirmed: true },
        select: { netAmount: true },
      });
      const completedPayouts = await db.payout.findMany({
        where: { ownerId, status: "COMPLETED" },
        select: { netAmount: true },
      });
      const inFlightPayouts = await db.payout.findMany({
        where: { ownerId, status: { in: ["PENDING", "PROCESSING"] } },
        select: { netAmount: true },
      });
      const onlineHeld = Math.max(
        0,
        onlineEarnings.reduce((s, e) => s + e.netAmount, 0) -
        completedPayouts.reduce((s, p) => s + p.netAmount, 0) -
        inFlightPayouts.reduce((s, p) => s + p.netAmount, 0)
      );

      if (onlineHeld < totalCashCommission) {
        return Response.json({
          error: `Not enough online balance to net. Admin holds Rs. ${Math.round(onlineHeld).toLocaleString()} but commission is Rs. ${Math.round(totalCashCommission).toLocaleString()}.`,
        }, { status: 400 });
      }

      // Create a commission-settlement payout record (reduces owner's available balance)
      await db.payout.create({
        data: {
          ownerId,
          amount:                totalCashCommission,
          commission:            0,
          netAmount:             totalCashCommission,
          status:                "COMPLETED",
          processedAt:           new Date(),
          isCommissionSettlement: true,
          notes: note?.trim() || "Cash commission netted from online earnings by admin.",
        },
      });
    }

    // Mark all unpaid cash commissions as settled and clear pending request
    await Promise.all([
      db.groundEarning.updateMany({
        where: { id: { in: unpaidCash.map((e) => e.id) } },
        data: {
          commissionPaid:      true,
          commissionSettledAt: new Date(),
          commissionNote: note?.trim() || (type === "net" ? "Netted from online earnings." : "Collected directly."),
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
    const notifyMsg = type === "net"
      ? `${amountStr} in platform commission has been deducted from your online earnings balance by the admin.`
      : `${amountStr} in platform commission from your cash bookings has been marked as collected. Thank you!`;

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
      type,
      note:   note?.trim() || undefined,
    });

    return Response.json({
      message: `Rs. ${Math.round(totalCashCommission).toLocaleString()} commission settled (${type}).`,
      settled: unpaidCash.length,
    });
  } catch (err) {
    console.error("[POST /api/admin/commissions/[ownerId]/settle]", err);
    return Response.json({ error: "Failed to settle commission." }, { status: 500 });
  }
}
