import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // All earnings across every owner — grouped by owner. Players pay owners directly (cash or
    // bank transfer), so every unpaid platform fee is owed by the owner to GoPlay.
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
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    // Fetch pending commission requests per owner (profile-level fields)
    const ownerProfiles = await db.groundOwnerProfile.findMany({
      where: { commissionRequestedAt: { not: null } },
      select: {
        id:                        true,
        commissionRequestedAt:     true,
        commissionRequestedAmount: true,
      },
    });
    const requestMap = new Map(ownerProfiles.map((p) => [p.id, p]));

    // Group by ownerId
    const ownerMap = new Map<string, {
      ownerId:        string;
      ownerName:      string;
      ownerEmail:     string;
      totalCommission:  number;
      paidCommission:   number;
      unpaidCommission: number;
      cashUnpaid:     number;
      onlineUnpaid:   number;
      commissionRequestedAt:     string | null;
      commissionRequestedAmount: number | null;
      earnings: typeof allEarnings;
    }>();

    for (const e of allEarnings) {
      const oid = e.ownerId;
      if (!ownerMap.has(oid)) {
        const req = requestMap.get(oid);
        ownerMap.set(oid, {
          ownerId:          oid,
          ownerName:        e.owner.user.name,
          ownerEmail:       e.owner.user.email,
          totalCommission:  0,
          paidCommission:   0,
          unpaidCommission: 0,
          cashUnpaid:       0,
          onlineUnpaid:     0,
          commissionRequestedAt:     req?.commissionRequestedAt?.toISOString() ?? null,
          commissionRequestedAmount: req?.commissionRequestedAmount ?? null,
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
    }

    const owners = Array.from(ownerMap.values())
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
