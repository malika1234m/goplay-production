import { db } from "@/lib/db";
import { getDefaultCommissionRate } from "@/lib/settings";

// GoPlay's money, for the admin dashboard. Players pay grounds directly (cash or bank transfer),
// so booking value is the grounds' money, not GoPlay's. GoPlay earns:
//   • commission on completed bookings, which grounds owe and settle with GoPlay, and
//   • the margin on open match lobbies GoPlay collects (players' payments − the ground's payout).
// Admin-only: none of this may reach players or owners.
// Everything is dated by when the game is played (booking date / lobby date), so a month's
// commission lines up with that month's bookings even if the earning was recorded later.

const LK_OFFSET_MS = 330 * 60_000; // Sri Lanka, UTC+05:30

/** Sri Lanka calendar day ("YYYY-MM-DD") of a timestamp. */
export function lkDay(d: Date) {
  return new Date(d.getTime() + LK_OFFSET_MS).toISOString().slice(0, 10);
}

/** First day of a Sri Lanka calendar month, `offset` months from this one (date columns are stored at UTC midnight). */
function lkMonth(offset = 0) {
  const now = new Date(Date.now() + LK_OFFSET_MS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

/** The instant a Sri Lanka calendar month begins — for timestamp columns such as createdAt. */
export function lkMonthStart(offset = 0) {
  return new Date(lkMonth(offset).getTime() - LK_OFFSET_MS);
}

const round = (n: number) => Math.round(n * 100) / 100;
const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Headline numbers for the dashboard and the earnings page. */
export async function financeSummary() {
  const [m0, m1, next] = [lkMonth(0), lkMonth(-1), lkMonth(1)];
  const sumBookings = (where: object) => db.facilityBooking.aggregate({ where: { status: "COMPLETED", ...where }, _sum: { totalAmount: true }, _count: true });
  const sumFees     = (where: object, played?: object) => db.groundEarning.aggregate({ where: { ...where, ...(played && { booking: { bookingDate: played } }) }, _sum: { platformFee: true } });

  const [bAll, bMonth, bLast, cAll, cMonth, cLast, cOpen, payouts, held, defaultRate] = await Promise.all([
    sumBookings({}),
    sumBookings({ bookingDate: { gte: m0, lt: next } }),
    sumBookings({ bookingDate: { gte: m1, lt: m0 } }),
    sumFees({}),
    sumFees({}, { gte: m0, lt: next }),
    sumFees({}, { gte: m1, lt: m0 }),
    sumFees({ commissionPaid: false, platformFee: { gt: 0 } }),
    db.lobbyPayout.findMany({ where: { status: { not: "CANCELLED" } }, select: { collectedAmount: true, amount: true, status: true, match: { select: { preferredDate: true } } } }),
    // Lobby money GoPlay holds for players: paid spots in lobbies that haven't filled yet
    db.openMatchSpot.aggregate({ where: { paymentStatus: "PAID", status: "RESERVED", match: { payee: "PLATFORM", status: "COLLECTING" } }, _sum: { amountPaid: true } }),
    getDefaultCommissionRate(),
  ]);

  const margin = (from?: Date, to?: Date) => round(payouts
    .filter((p) => (!from || p.match.preferredDate >= from) && (!to || p.match.preferredDate < to))
    .reduce((s, p) => s + p.collectedAmount - p.amount, 0));

  const commission = {
    total:       round(cAll._sum.platformFee ?? 0),
    month:       round(cMonth._sum.platformFee ?? 0),
    lastMonth:   round(cLast._sum.platformFee ?? 0),
    outstanding: round(cOpen._sum.platformFee ?? 0),
  };
  const lobbyMargin = { total: margin(), month: margin(m0, next), lastMonth: margin(m1, m0) };
  const goplay = {
    total:     round(commission.total + lobbyMargin.total),
    month:     round(commission.month + lobbyMargin.month),
    lastMonth: round(commission.lastMonth + lobbyMargin.lastMonth),
  };

  return {
    // GoPlay's own earnings
    goplay:      { ...goplay, change: change(goplay.month, goplay.lastMonth) },
    commission:  { ...commission, collected: round(commission.total - commission.outstanding) },
    lobbyMargin,
    // Money that is the grounds' (paid to them directly), shown for scale only
    bookingValue: {
      total:     round(bAll._sum.totalAmount ?? 0),
      month:     round(bMonth._sum.totalAmount ?? 0),
      lastMonth: round(bLast._sum.totalAmount ?? 0),
      change:    change(bMonth._sum.totalAmount ?? 0, bLast._sum.totalAmount ?? 0),
      bookings:  bAll._count,
    },
    // Lobby money GoPlay is holding: owed to grounds (payouts due) or still in open lobbies
    lobbyHeld: {
      payoutsDue: round(payouts.filter((p) => p.status === "DUE").reduce((s, p) => s + p.amount, 0)),
      inOpenLobbies: round(held._sum.amountPaid ?? 0),
    },
    defaultCommissionRate: Math.round(defaultRate * 10000) / 100,
  };
}

/** Day-by-day booking value and GoPlay earnings for the last `days` days (Sri Lanka dates). */
export async function financeTrend(days: number) {
  const today = lkDay(new Date());
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);

  const [bookings, fees, payouts] = await Promise.all([
    db.facilityBooking.groupBy({ by: ["bookingDate"], where: { status: "COMPLETED", bookingDate: { gte: start } }, _sum: { totalAmount: true } }),
    db.groundEarning.findMany({ where: { platformFee: { gt: 0 }, booking: { bookingDate: { gte: start } } }, select: { platformFee: true, booking: { select: { bookingDate: true } } } }),
    db.lobbyPayout.findMany({ where: { status: { not: "CANCELLED" }, match: { preferredDate: { gte: start } } }, select: { collectedAmount: true, amount: true, match: { select: { preferredDate: true } } } }),
  ]);

  const points = new Map<string, { date: string; bookingValue: number; goplay: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    points.set(key, { date: key, bookingValue: 0, goplay: 0 });
  }
  for (const b of bookings) {
    const p = points.get(b.bookingDate.toISOString().slice(0, 10));
    if (p) p.bookingValue += b._sum.totalAmount ?? 0;
  }
  for (const f of fees) {
    const p = points.get(f.booking.bookingDate.toISOString().slice(0, 10));
    if (p) p.goplay += f.platformFee;
  }
  for (const l of payouts) {
    const p = points.get(l.match.preferredDate.toISOString().slice(0, 10));
    if (p) p.goplay += l.collectedAmount - l.amount;
  }
  return [...points.values()].map((p) => ({ ...p, bookingValue: round(p.bookingValue), goplay: round(p.goplay) }));
}

/** Per-ground money: what players paid the ground, what it owes GoPlay, and GoPlay's lobby margin there. */
export async function financeByFacility() {
  const [facilities, bookings, fees, openFees, payouts, defaultRate] = await Promise.all([
    db.sportsFacility.findMany({
      where:  { OR: [{ bookings: { some: { status: "COMPLETED" } } }, { commissionRate: { not: null } }] },
      select: { id: true, name: true, city: true, commissionRate: true, owner: { select: { id: true, user: { select: { name: true, email: true } } } } },
    }),
    db.facilityBooking.groupBy({ by: ["facilityId"], where: { status: "COMPLETED" }, _sum: { totalAmount: true }, _count: true }),
    db.groundEarning.groupBy({ by: ["facilityId"], _sum: { platformFee: true } }),
    db.groundEarning.groupBy({ by: ["facilityId"], where: { commissionPaid: false, platformFee: { gt: 0 } }, _sum: { platformFee: true } }),
    db.lobbyPayout.findMany({ where: { status: { not: "CANCELLED" } }, select: { facilityId: true, collectedAmount: true, amount: true } }),
    getDefaultCommissionRate(),
  ]);

  const byId = <T extends { facilityId: string }>(rows: T[]) => new Map(rows.map((r) => [r.facilityId, r]));
  const [bk, fe, op] = [byId(bookings), byId(fees), byId(openFees)];
  const lobby = new Map<string, number>();
  for (const p of payouts) lobby.set(p.facilityId, (lobby.get(p.facilityId) ?? 0) + p.collectedAmount - p.amount);

  return facilities.map((f) => {
    const commission  = round(fe.get(f.id)?._sum.platformFee ?? 0);
    const lobbyMargin = round(lobby.get(f.id) ?? 0);
    return {
      facilityId:     f.id,
      facilityName:   f.name,
      city:           f.city,
      ownerId:        f.owner.id,
      ownerName:      f.owner.user.name,
      ownerEmail:     f.owner.user.email,
      commissionRate: f.commissionRate ?? Math.round(defaultRate * 10000) / 100,
      customRate:     f.commissionRate != null,
      bookings:       bk.get(f.id)?._count ?? 0,
      bookingValue:   round(bk.get(f.id)?._sum.totalAmount ?? 0),
      commission,
      outstanding:    round(op.get(f.id)?._sum.platformFee ?? 0),
      lobbyMargin,
      goplay:         round(commission + lobbyMargin),
    };
  }).sort((a, b) => b.goplay - a.goplay || b.bookingValue - a.bookingValue);
}
