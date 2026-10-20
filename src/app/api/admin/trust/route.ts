import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { slotInstant } from "@/lib/local-time";
import { BLOCK_REASON_LABEL } from "@/lib/trust";

// GET /api/admin/trust — cash (pay-at-ground) booking trust & safety for admins:
// no-show reports with the evidence to judge them, cash bookings grounds never settled,
// players and grounds at risk, and blocked accounts.

const DAY = 86_400_000;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return Response.json({ error: "Forbidden." }, { status: 403 });

  const since90 = new Date(Date.now() - 90 * DAY);
  const player  = { select: { id: true, name: true, email: true, phone: true, createdAt: true, emailVerifiedAt: true, isActive: true, noShowCount: true, cashCancelCount: true, requiresOnlinePayment: true, isBookingSuspended: true } } as const;
  const ground  = { select: { id: true, name: true, city: true, owner: { select: { user: { select: { id: true, name: true, email: true, phone: true } } } } } } as const;

  const [reports, unresolvedRaw, cashStats, blocks] = await Promise.all([
    // Pending reports first, then the last 60 days of decisions for reference
    db.facilityBooking.findMany({
      where:   { status: "NO_SHOW", OR: [{ noShowReview: "PENDING" }, { noShowReview: null }, { noShowReviewedAt: { gte: new Date(Date.now() - 60 * DAY) } }] },
      orderBy: [{ noShowReview: "asc" }, { noShowMarkedAt: "desc" }],
      take:    200,
      select:  {
        id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, paymentMethod: true, contactEmail: true, contactNumber: true,
        noShowMarkedAt: true, noShowMarkedBy: true, noShowReview: true, noShowDispute: true, noShowDisputedAt: true,
        noShowReviewedAt: true, noShowReviewNote: true, facilityId: true, userId: true,
        user: player, facility: ground,
      },
    }),
    // Cash bookings whose time is over but the ground never marked them completed or no-show
    db.facilityBooking.findMany({
      where:   { paymentMethod: "ON_ARRIVAL", isOpenMatch: false, status: { in: ["PENDING", "CONFIRMED"] }, bookingDate: { lt: new Date(Date.now() - DAY) } },
      orderBy: { bookingDate: "asc" },
      take:    300,
      select:  { id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true, phone: true } }, facility: ground },
    }),
    // Cash outcomes per ground and player over the last 90 days
    db.facilityBooking.findMany({
      where:  { paymentMethod: "ON_ARRIVAL", isOpenMatch: false, bookingDate: { gte: since90 }, status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED", "CONFIRMED", "PENDING"] } },
      select: { userId: true, facilityId: true, status: true, noShowReview: true, cancelledBy: true },
    }),
    db.accountBlock.findMany({ orderBy: [{ liftedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], take: 200 }),
  ]);

  // ── Ground statistics ────────────────────────────────────────────────────
  type G = { completed: number; noShows: number; overturned: number; total: number };
  const byGround = new Map<string, G>();
  let platformCompleted = 0, platformNoShows = 0;
  for (const b of cashStats) {
    const g = byGround.get(b.facilityId) ?? { completed: 0, noShows: 0, overturned: 0, total: 0 };
    if (b.status === "COMPLETED") { g.completed++; platformCompleted++; }
    if (b.status === "NO_SHOW" && b.noShowReview !== "OVERTURNED") { g.noShows++; platformNoShows++; }
    if (b.noShowReview === "OVERTURNED") g.overturned++;
    g.total++;
    byGround.set(b.facilityId, g);
  }
  const rate = (n: number, of: number) => (of > 0 ? n / of : 0);
  const platformRate = rate(platformNoShows, platformNoShows + platformCompleted);

  const unresolvedByGround = new Map<string, number>();
  const unresolved = unresolvedRaw.filter((b) => slotInstant(b.bookingDate, b.endTime).getTime() < Date.now() - DAY);
  for (const b of unresolved) unresolvedByGround.set(b.facility.id, (unresolvedByGround.get(b.facility.id) ?? 0) + 1);

  const facilityIds = [...new Set([...byGround.keys(), ...unresolvedByGround.keys()])];
  const facilities  = await db.sportsFacility.findMany({ where: { id: { in: facilityIds } }, ...ground });
  const grounds = facilities.map((f) => {
    const g = byGround.get(f.id) ?? { completed: 0, noShows: 0, overturned: 0, total: 0 };
    const noShowRate = rate(g.noShows, g.noShows + g.completed);
    const flags: string[] = [];
    if (g.noShows >= 3 && platformRate > 0 && noShowRate > platformRate * 2) flags.push(`No-show rate ${Math.round(noShowRate * 100)}% — over twice the platform average`);
    if (g.overturned > 0) flags.push(`${g.overturned} no-show report${g.overturned > 1 ? "s" : ""} overturned`);
    if ((unresolvedByGround.get(f.id) ?? 0) >= 3) flags.push(`${unresolvedByGround.get(f.id)} cash bookings never settled`);
    return { ...f, ...g, noShowRate, unresolved: unresolvedByGround.get(f.id) ?? 0, flags };
  }).sort((a, b) => b.flags.length - a.flags.length || b.noShowRate - a.noShowRate);
  const groundById = new Map(grounds.map((g) => [g.id, g]));

  // ── Players ──────────────────────────────────────────────────────────────
  const activeBlocks = new Map(blocks.filter((b) => !b.liftedAt && b.userId).map((b) => [b.userId!, b]));
  const riskyUsers = await db.user.findMany({
    where:  { role: "USER", OR: [{ noShowCount: { gt: 0 } }, { cashCancelCount: { gt: 0 } }, { isActive: false }, { id: { in: [...activeBlocks.keys()] } }] },
    take:   300,
    ...player,
  });
  const playerHistory = await db.facilityBooking.findMany({
    where:  { userId: { in: riskyUsers.map((u) => u.id) }, paymentMethod: "ON_ARRIVAL", isOpenMatch: false },
    select: { userId: true, facilityId: true, status: true, noShowReview: true, bookingDate: true },
  });
  const players = riskyUsers.map((u) => {
    const mine       = playerHistory.filter((b) => b.userId === u.id);
    const noShowRows = mine.filter((b) => b.status === "NO_SHOW" && b.noShowReview !== "OVERTURNED");
    const completed  = mine.filter((b) => b.status === "COMPLETED").length;
    const grounds    = new Set(noShowRows.map((b) => b.facilityId)).size;
    const block      = activeBlocks.get(u.id);
    const risk       = noShowRows.length * 3 + grounds * 2 + u.cashCancelCount - completed;
    return {
      ...u, cashBookings: mine.length, completed, noShows: noShowRows.length, noShowGrounds: grounds,
      noShowRate: rate(noShowRows.length, noShowRows.length + completed), risk,
      lastBooking: mine.reduce<Date | null>((d, b) => (!d || b.bookingDate > d ? b.bookingDate : d), null),
      block: block ? { id: block.id, reason: BLOCK_REASON_LABEL[block.reason], details: block.details, createdAt: block.createdAt } : null,
    };
  }).sort((a, b) => b.risk - a.risk);

  // ── No-show reports with the evidence an admin needs ─────────────────────
  const reporterIds = [...new Set(reports.map((r) => r.noShowMarkedBy).filter((x): x is string => !!x))];
  const [reporters, otherNoShows, completedCounts] = await Promise.all([
    db.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, name: true, role: true } }),
    db.facilityBooking.findMany({
      where:  { userId: { in: [...new Set(reports.map((r) => r.userId))] }, status: "NO_SHOW", NOT: { noShowReview: "OVERTURNED" } },
      select: { id: true, userId: true, facilityId: true },
    }),
    db.facilityBooking.groupBy({ by: ["userId"], where: { userId: { in: [...new Set(reports.map((r) => r.userId))] }, status: "COMPLETED" }, _count: true }),
  ]);
  const reporterById  = new Map(reporters.map((r) => [r.id, r]));
  const completedById = new Map(completedCounts.map((c) => [c.userId, c._count]));

  const reportRows = reports.map((r) => {
    const others      = otherNoShows.filter((o) => o.userId === r.userId && o.id !== r.id);
    const otherGrounds = new Set(others.filter((o) => o.facilityId !== r.facilityId).map((o) => o.facilityId)).size;
    const sameGround  = others.filter((o) => o.facilityId === r.facilityId).length;
    const completed   = completedById.get(r.userId) ?? 0;
    const g           = groundById.get(r.facilityId);
    const minsAfterStart = r.noShowMarkedAt ? Math.round((r.noShowMarkedAt.getTime() - slotInstant(r.bookingDate, r.startTime).getTime()) / 60_000) : null;
    const reporter    = r.noShowMarkedBy ? reporterById.get(r.noShowMarkedBy) : null;

    // Evidence, strongest first. Each item leans one way: towards the player or towards the ground.
    const signals: { text: string; leans: "player" | "ground" | "neutral" }[] = [];
    if (otherGrounds > 0) signals.push({ text: `No-shows at ${otherGrounds} other ground${otherGrounds > 1 ? "s" : ""}`, leans: "player" });
    if (sameGround > 0)   signals.push({ text: `${sameGround} earlier no-show${sameGround > 1 ? "s" : ""} at this same ground`, leans: "neutral" });
    if (r.noShowDispute)  signals.push({ text: "Player disputes it", leans: "ground" });
    if (g && g.noShows >= 3 && platformRate > 0 && g.noShowRate > platformRate * 2) signals.push({ text: `Ground's no-show rate is ${Math.round(g.noShowRate * 100)}% (platform ${Math.round(platformRate * 100)}%)`, leans: "ground" });
    if (g && g.overturned > 0) signals.push({ text: `Ground had ${g.overturned} report${g.overturned > 1 ? "s" : ""} overturned before`, leans: "ground" });
    if (completed >= 3 && others.length === 0) signals.push({ text: `${completed} completed bookings, no other no-shows`, leans: "ground" });
    if (minsAfterStart !== null && minsAfterStart < 15) signals.push({ text: `Marked ${Math.max(0, minsAfterStart)} min after the start`, leans: "ground" });
    if (r.contactEmail) signals.push({ text: "Player verified their email for this booking", leans: "neutral" });
    if (Date.now() - r.user.createdAt.getTime() < 7 * DAY) signals.push({ text: "Account less than a week old", leans: "neutral" });

    const towardsPlayer = signals.filter((s) => s.leans === "player").length;
    const towardsGround = signals.filter((s) => s.leans === "ground").length;
    const hint = towardsGround > towardsPlayer ? "check_ground" : towardsPlayer > 0 && !r.noShowDispute ? "likely_genuine" : "review";

    return {
      ...r,
      review: r.noShowReview ?? "PENDING",
      reporter: reporter ? { name: reporter.name, role: reporter.role } : null,
      minsAfterStart, playerCompleted: completed, playerNoShows: others.length + 1, signals, hint,
      blocked: activeBlocks.has(r.userId),
    };
  });

  return Response.json({
    summary: {
      reportsToReview: reportRows.filter((r) => r.review === "PENDING").length,
      disputed:        reportRows.filter((r) => r.review === "PENDING" && r.noShowDispute).length,
      unresolved:      unresolved.length,
      flaggedGrounds:  grounds.filter((g) => g.flags.length > 0).length,
      blocked:         blocks.filter((b) => !b.liftedAt).length,
      platformNoShowRate: platformRate,
    },
    reports: reportRows,
    unresolved,
    players,
    grounds,
    blocks: blocks.map((b) => ({ ...b, reasonLabel: BLOCK_REASON_LABEL[b.reason] })),
    reasons: BLOCK_REASON_LABEL,
  });
}
