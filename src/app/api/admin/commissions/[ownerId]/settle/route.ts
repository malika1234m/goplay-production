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
    const { note, reference, expectedTotal } = await req.json().catch(() => ({}));
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) || null : null;
    const cleanRef  = typeof reference === "string" ? reference.trim().slice(0, 100) || null : null;

    const profile = await db.groundOwnerProfile.findUnique({
      where: { id: ownerId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!profile) return Response.json({ error: "Owner not found." }, { status: 404 });

    // Recorded as one settlement: the payment, its reference, and exactly the earnings it paid for
    const result = await db.$transaction(async (tx) => {
      const unpaid = await tx.groundEarning.findMany({
        where:  { ownerId, commissionPaid: false, platformFee: { gt: 0 } },
        select: { id: true, platformFee: true },
      });
      if (unpaid.length === 0) return { kind: "none" } as const;
      const total = Math.round(unpaid.reduce((s, e) => s + e.platformFee, 0) * 100) / 100;
      // The admin confirms the total they saw; commission earned since then isn't swept in unpaid
      if (typeof expectedTotal === "number" && Math.abs(total - expectedTotal) > 0.005) return { kind: "changed", total } as const;

      const settlement = await tx.commissionSettlement.create({
        data: { ownerId, amount: total, reference: cleanRef, note: cleanNote, settledBy: session.user.id },
      });
      const marked = await tx.groundEarning.updateMany({
        where: { id: { in: unpaid.map((e) => e.id) }, commissionPaid: false },
        data:  {
          commissionPaid:      true,
          commissionSettledAt: new Date(),
          settlementId:        settlement.id,
          commissionNote:      [cleanRef && `Ref: ${cleanRef}`, cleanNote].filter(Boolean).join(" — ") || "Collected directly.",
        },
      });
      if (marked.count !== unpaid.length) throw new Error("settle-race");   // someone settled part of it: roll back
      await tx.groundOwnerProfile.update({ where: { id: ownerId }, data: { commissionRequestedAt: null, commissionRequestedAmount: null } });
      return { kind: "settled", total, count: unpaid.length, settlementId: settlement.id } as const;
    }).catch((e: Error) => (e.message === "settle-race" ? ({ kind: "race" } as const) : Promise.reject(e)));

    if (result.kind === "none")    return Response.json({ error: "No outstanding commissions for this owner." }, { status: 400 });
    if (result.kind === "race")    return Response.json({ error: "Someone else just recorded a payment for this owner. Refresh and check." }, { status: 409 });
    if (result.kind === "changed") {
      return Response.json({ error: `The outstanding amount is now Rs. ${result.total.toLocaleString()} (new commission came in). Refresh and confirm the new total.` }, { status: 409 });
    }
    const totalCashCommission = result.total;

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
      note:   cleanNote ?? undefined,
    });

    return Response.json({
      message: `Rs. ${Math.round(totalCashCommission).toLocaleString()} commission settled.`,
      settled:      result.count,
      settlementId: result.settlementId,
    });
  } catch (err) {
    console.error("[POST /api/admin/commissions/[ownerId]/settle]", err);
    return Response.json({ error: "Failed to settle commission." }, { status: 500 });
  }
}
