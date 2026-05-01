import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // All earnings across every owner — grouped by owner
    const allEarnings = await db.groundEarning.findMany({
      include: {
        facility: { select: { name: true, city: true } },
        booking: {
          select: {
            bookingDate: true,
            startTime:   true,
            endTime:     true,
            user:        { select: { name: true } },
          },
        },
        owner: {
          include: {
            user:    { select: { id: true, name: true, email: true } },
            payouts: { select: { status: true, netAmount: true, isCommissionSettlement: true } },
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    // Group by ownerId
    const ownerMap = new Map<string, {
      ownerId:        string;
      ownerName:      string;
      ownerEmail:     string;
      totalCommission:  number;
      paidCommission:   number;
      unpaidCommission: number;
      // cash commissions outstanding (admin must chase or net)
      cashUnpaid:     number;
      // online commissions outstanding (settled when payout completes)
      onlineUnpaid:   number;
      // online balance admin currently holds for this owner
      onlineHeld:     number;
      earnings: typeof allEarnings;
    }>();

    for (const e of allEarnings) {
      const oid = e.ownerId;
      if (!ownerMap.has(oid)) {
        // Calculate online held = netOnline - completed payouts - in-flight payouts (excl commission settlements)
        const completedPayout  = e.owner.payouts
          .filter((p) => p.status === "COMPLETED")
          .reduce((s, p) => s + p.netAmount, 0);
        const inFlightPayout   = e.owner.payouts
          .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
          .reduce((s, p) => s + p.netAmount, 0);

        // netOnline = sum of netAmount for ONLINE earnings with cashConfirmed — computed below
        ownerMap.set(oid, {
          ownerId:          oid,
          ownerName:        e.owner.user.name,
          ownerEmail:       e.owner.user.email,
          totalCommission:  0,
          paidCommission:   0,
          unpaidCommission: 0,
          cashUnpaid:       0,
          onlineUnpaid:     0,
          onlineHeld:       -(completedPayout + inFlightPayout), // will add netAmount below
          earnings:         [],
        });
      }

      const grp = ownerMap.get(oid)!;
      grp.earnings.push(e);
      grp.totalCommission  += e.platformFee;
      if (e.commissionPaid) {
        grp.paidCommission += e.platformFee;
      } else {
        grp.unpaidCommission += e.platformFee;
        if (e.paymentMethod === "ON_ARRIVAL") grp.cashUnpaid   += e.platformFee;
        else                                  grp.onlineUnpaid += e.platformFee;
      }
      // Accumulate online held (only confirmed online earnings)
      if (e.paymentMethod === "ONLINE" && e.cashConfirmed) {
        grp.onlineHeld += e.netAmount;
      }
    }

    const owners = Array.from(ownerMap.values())
      .map((o) => ({
        ...o,
        onlineHeld: Math.max(0, o.onlineHeld),
        canNet:     Math.max(0, o.onlineHeld) > 0 && o.cashUnpaid > 0,
      }))
      .sort((a, b) => b.unpaidCommission - a.unpaidCommission);

    const summary = {
      totalUnpaid:        owners.reduce((s, o) => s + o.unpaidCommission, 0),
      totalCashUnpaid:    owners.reduce((s, o) => s + o.cashUnpaid,       0),
      totalOnlineUnpaid:  owners.reduce((s, o) => s + o.onlineUnpaid,     0),
      totalCollected:     owners.reduce((s, o) => s + o.paidCommission,   0),
      ownersWithDebt:     owners.filter((o) => o.unpaidCommission > 0).length,
    };

    return Response.json({ summary, owners });
  } catch (err) {
    console.error("[GET /api/admin/commissions]", err);
    return Response.json({ error: "Failed to fetch commissions." }, { status: 500 });
  }
}
