import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 1. Real payout requests only (exclude commission netting records) ──
    const payouts = await db.payout.findMany({
      where: { isCommissionSettlement: false },
      include: {
        owner: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    const summary = {
      pending:            payouts.filter((p) => p.status === "PENDING").length,
      processing:         payouts.filter((p) => p.status === "PROCESSING").length,
      totalPendingAmount: payouts
        .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
        .reduce((s, p) => s + p.netAmount, 0),
      totalPaidOut: payouts
        .filter((p) => p.status === "COMPLETED")
        .reduce((s, p) => s + p.netAmount, 0),
    };

    // ── 2. "What admin owes" — per ground owner balance ──
    // Sum of ONLINE completed earnings per owner, minus their already-completed payouts.
    const allOnlineEarnings = await db.groundEarning.findMany({
      where: { paymentMethod: "ONLINE", cashConfirmed: true },
      select: {
        ownerId:     true,
        grossAmount: true,
        platformFee: true,
        netAmount:   true,
        earnedAt:    true,
        facility:    { select: { name: true, city: true } },
        booking: {
          select: {
            bookingDate: true,
            startTime:   true,
            endTime:     true,
            user:        { select: { name: true } },
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    // Group earnings by owner
    const ownerEarningsMap = new Map<string, {
      grossOnline: number;
      feeOnline:   number;
      netOnline:   number;
      earnings:    typeof allOnlineEarnings;
    }>();

    for (const e of allOnlineEarnings) {
      if (!ownerEarningsMap.has(e.ownerId)) {
        ownerEarningsMap.set(e.ownerId, { grossOnline: 0, feeOnline: 0, netOnline: 0, earnings: [] });
      }
      const grp = ownerEarningsMap.get(e.ownerId)!;
      grp.grossOnline += e.grossAmount;
      grp.feeOnline   += e.platformFee;
      grp.netOnline   += e.netAmount;
      grp.earnings.push(e);
    }

    // For each owner, subtract completed payouts to get current balance
    const allOwnerProfiles = await db.groundOwnerProfile.findMany({
      where: { id: { in: Array.from(ownerEarningsMap.keys()) } },
      include: {
        user:    { select: { id: true, name: true, email: true } },
        payouts: { select: { status: true, netAmount: true } },
      },
    });

    const owedToOwners = allOwnerProfiles
      .map((profile) => {
        const earningsData = ownerEarningsMap.get(profile.id) ?? { grossOnline: 0, feeOnline: 0, netOnline: 0, earnings: [] };
        const paidOut = profile.payouts
          .filter((p) => p.status === "COMPLETED")
          .reduce((s, p) => s + p.netAmount, 0);
        const inFlight = profile.payouts
          .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
          .reduce((s, p) => s + p.netAmount, 0);
        const currentlyOwed = Math.max(0, earningsData.netOnline - paidOut - inFlight);

        return {
          ownerId:      profile.id,
          ownerName:    profile.user.name,
          ownerEmail:   profile.user.email,
          grossOnline:  earningsData.grossOnline,
          feeOnline:    earningsData.feeOnline,
          netOnline:    earningsData.netOnline,
          paidOut,
          inFlight,
          currentlyOwed,
          bookingCount: earningsData.earnings.length,
          earnings:     earningsData.earnings,
        };
      })
      .sort((a, b) => b.currentlyOwed - a.currentlyOwed);

    const totalOwed = owedToOwners.reduce((s, o) => s + o.currentlyOwed, 0);

    return Response.json({
      summary: { ...summary, totalOwed },
      payouts: payouts.map((p) => ({
        id:               p.id,
        ownerName:        p.owner.user.name,
        ownerEmail:       p.owner.user.email,
        bankName:         p.owner.bankName,
        bankBranch:       p.owner.bankBranch,
        accountNumber:    p.owner.accountNumber,
        accountHolderName: p.owner.accountHolderName,
        amount:           p.amount,
        commission:       p.commission,
        netAmount:        p.netAmount,
        status:           p.status,
        requestedAt:      p.requestedAt,
        processedAt:      p.processedAt,
        reference:        p.reference,
        notes:            p.notes,
      })),
      owedToOwners,
    });
  } catch (err) {
    console.error("[GET /api/admin/payouts]", err);
    return Response.json({ error: "Failed to fetch payouts." }, { status: 500 });
  }
}
