import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPlatformPaymentDetails } from "@/lib/lobby-payments";
import { financeSummary } from "@/lib/admin-finance";

// GET /api/admin/lobby-payments — everything GoPlay handles for lobbies it collected:
// receipts to check, payouts owed to grounds, refunds owed to players, and the money summary.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden." }, { status: 403 });

  const player = { select: { id: true, name: true, email: true, phone: true } } as const;
  const lobby  = {
    select: {
      id: true, lobbyCode: true, status: true, preferredDate: true, preferredStartTime: true, preferredEndTime: true,
      category: { select: { name: true } }, facility: { select: { id: true, name: true, city: true } },
    },
  } as const;

  const [receipts, payouts, refunds, paidSpots, bankAccount, finance, payoutTotals, refundTotals] = await Promise.all([
    db.openMatchSpot.findMany({
      where:   { match: { payee: "PLATFORM" }, status: "RESERVED", paymentStatus: "RECEIPT_SUBMITTED" },
      orderBy: { receiptUploadedAt: "asc" },
      select:  { id: true, groupSize: true, amountDue: true, receiptUrl: true, receiptUploadedAt: true, createdAt: true, user: player, match: lobby },
    }),
    db.lobbyPayout.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take:    200,
      include: {
        match:    lobby,
        facility: { select: { name: true, owner: { select: { bankName: true, bankBranch: true, accountHolderName: true, accountNumber: true, user: { select: { name: true, email: true, phone: true } } } } } },
      },
    }),
    db.openMatchSpot.findMany({
      where:   { match: { payee: "PLATFORM" }, refundStatus: { in: ["NEEDED", "PROCESSED"] } },
      orderBy: [{ refundStatus: "asc" }, { cancelledAt: "desc" }],
      take:    200,
      select:  {
        id: true, groupSize: true, amountDue: true, paymentStatus: true, receiptUrl: true, cancelledAt: true,
        refundStatus: true, refundAmount: true, refundBankName: true, refundBankBranch: true, refundAccountName: true,
        refundAccountNumber: true, refundDetailsAt: true, refundReference: true, refundedAt: true,
        user: player, match: lobby,
      },
    }),
    // Money GoPlay actually received (confirmed receipts) on lobbies it collected
    db.openMatchSpot.aggregate({ where: { match: { payee: "PLATFORM" }, paymentStatus: { in: ["PAID", "REFUNDED"] } }, _sum: { amountPaid: true } }),
    getPlatformPaymentDetails(),
    // Totals over every lobby (the lists above are capped), from the same source as Earnings
    financeSummary(),
    db.lobbyPayout.groupBy({ by: ["status"], _sum: { amount: true, commissionAmount: true }, _count: true }),
    db.openMatchSpot.groupBy({ by: ["refundStatus"], where: { match: { payee: "PLATFORM" }, refundStatus: { in: ["NEEDED", "PROCESSED"] } }, _sum: { refundAmount: true }, _count: true }),
  ]);

  const received = paidSpots._sum.amountPaid ?? 0;
  const payoutBy   = (st: string) => payoutTotals.find((t) => t.status === st);
  const refundBy   = (st: string) => refundTotals.find((t) => t.refundStatus === st);

  return Response.json({
    bankAccountSet: !!bankAccount,
    receipts,
    payouts,
    refunds: refunds.map((r) => ({ ...r, verified: r.paymentStatus !== "RECEIPT_SUBMITTED" })),
    summary: {
      // Counts and totals are over every lobby, not just the lists shown
      receiptsToCheck: receipts.length,
      payoutsDue:      payoutBy("DUE")?._count ?? 0,
      payoutsDueTotal: payoutBy("DUE")?._sum.amount ?? 0,
      refundsDue:      refundBy("NEEDED")?._count ?? 0,
      refundsDueTotal: refundBy("NEEDED")?._sum.refundAmount ?? 0,
      received,
      paidOut:         payoutBy("PAID")?._sum.amount ?? 0,
      refunded:        refundBy("PROCESSED")?._sum.refundAmount ?? 0,
      // What GoPlay keeps: filled lobbies (collected minus the ground's payout) plus what the
      // cancellation policy kept from players who left — the same figure as the Earnings page
      goplayEarned:    finance.lobbyMargin.total + finance.lobbyRetained.total,
      commission:      (payoutBy("DUE")?._sum.commissionAmount ?? 0) + (payoutBy("PAID")?._sum.commissionAmount ?? 0),
    },
  });
}
