import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getPlatformPaymentDetails } from "@/lib/lobby-payments";

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

  const [receipts, payouts, refunds, paidSpots, bankAccount] = await Promise.all([
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
  ]);

  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
  const refundsPaid = refunds.filter((r) => r.refundStatus === "PROCESSED");
  const payoutsPaid = payouts.filter((p) => p.status === "PAID");
  const received    = paidSpots._sum.amountPaid ?? 0;

  return Response.json({
    bankAccountSet: !!bankAccount,
    receipts,
    payouts,
    refunds: refunds.map((r) => ({ ...r, verified: r.paymentStatus !== "RECEIPT_SUBMITTED" })),
    summary: {
      receiptsToCheck: receipts.length,
      payoutsDue:      payouts.filter((p) => p.status === "DUE").length,
      payoutsDueTotal: sum(payouts.filter((p) => p.status === "DUE"), (p) => p.amount),
      refundsDue:      refunds.filter((r) => r.refundStatus === "NEEDED").length,
      refundsDueTotal: sum(refunds.filter((r) => r.refundStatus === "NEEDED"), (r) => r.refundAmount ?? 0),
      received,
      paidOut:         sum(payoutsPaid, (p) => p.amount),
      refunded:        sum(refundsPaid, (r) => r.refundAmount ?? 0),
      // What GoPlay keeps from filled lobbies: everything collected minus the ground's payout
      goplayEarned:    sum(payouts.filter((p) => p.status !== "CANCELLED"), (p) => p.collectedAmount - p.amount),
      commission:      sum(payouts.filter((p) => p.status !== "CANCELLED"), (p) => p.commissionAmount),
    },
  });
}
