import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { BLOCK_REASON_LABEL } from "@/lib/trust";

// GET /api/admin/users/:id — one account at a glance: who they are, how they book (players)
// or what they run and owe (ground owners), any restrictions or block, and their recent bookings.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where:  { id },
    select: {
      id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, emailVerifiedAt: true,
      noShowCount: true, cashCancelCount: true, requiresOnlinePayment: true, isBookingSuspended: true,
      groundOwnerProfile: { select: { id: true, businessName: true, phone: true, city: true, bankName: true, accountHolderName: true, accountNumber: true, commissionRequestedAmount: true, commissionRequestedAt: true } },
      facilityWorker:     { select: { facility: { select: { id: true, name: true } } } },
    },
  });
  if (!user) return Response.json({ error: "User not found." }, { status: 404 });

  const [byStatus, spend, recent, block, lobbySpots] = await Promise.all([
    db.facilityBooking.groupBy({ by: ["status"], where: { userId: id, isOpenMatch: false }, _count: true }),
    db.facilityBooking.aggregate({ where: { userId: id, status: "COMPLETED" }, _sum: { totalAmount: true } }),
    db.facilityBooking.findMany({
      where:   { userId: id },
      orderBy: { bookingDate: "desc" },
      take:    8,
      select:  { id: true, bookingDate: true, startTime: true, endTime: true, status: true, totalAmount: true, paymentMethod: true, facility: { select: { name: true } } },
    }),
    db.accountBlock.findFirst({ where: { userId: id, liftedAt: null }, select: { id: true, reason: true, details: true, createdAt: true } }),
    db.openMatchSpot.count({ where: { userId: id } }),
  ]);

  // Ground owners: their grounds and what they owe GoPlay
  let owner: null | {
    grounds: { id: string; name: string; city: string; status: string; commissionRate: number | null; bookings: number }[];
    commissionOwed: number; commissionPaid: number;
  } = null;
  if (user.groundOwnerProfile) {
    const [grounds, owed, paid] = await Promise.all([
      db.sportsFacility.findMany({
        where:  { ownerId: user.groundOwnerProfile.id },
        select: { id: true, name: true, city: true, status: true, commissionRate: true, _count: { select: { bookings: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.groundEarning.aggregate({ where: { ownerId: user.groundOwnerProfile.id, commissionPaid: false }, _sum: { platformFee: true } }),
      db.groundEarning.aggregate({ where: { ownerId: user.groundOwnerProfile.id, commissionPaid: true },  _sum: { platformFee: true } }),
    ]);
    owner = {
      grounds: grounds.map(({ _count, ...g }) => ({ ...g, bookings: _count.bookings })),
      commissionOwed: Math.round((owed._sum.platformFee ?? 0) * 100) / 100,
      commissionPaid: Math.round((paid._sum.platformFee ?? 0) * 100) / 100,
    };
  }

  const counts = Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Record<string, number>;
  return Response.json({
    user,
    bookings: {
      total:     Object.values(counts).reduce((s, n) => s + n, 0),
      completed: counts.COMPLETED ?? 0,
      upcoming:  (counts.PENDING ?? 0) + (counts.CONFIRMED ?? 0),
      cancelled: counts.CANCELLED ?? 0,
      noShows:   counts.NO_SHOW ?? 0,
      spent:     spend._sum.totalAmount ?? 0,
      lobbySpots,
      recent,
    },
    block: block ? { ...block, reasonLabel: BLOCK_REASON_LABEL[block.reason] } : null,
    owner,
    reasons: BLOCK_REASON_LABEL,
    isSelf: id === session.user.id,
  });
}
