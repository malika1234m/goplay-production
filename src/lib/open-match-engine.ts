import { db, type DbTx } from "@/lib/db";
import { facilityTakesBookings, slotUsage, withFacilityDayLock } from "@/lib/slot-capacity";
import { createNotification } from "@/lib/notify";
import { sendMatchFoundEmail, sendMatchExpiredEmail, sendNewBookingAlertEmail } from "@/lib/email";
import { calcLobbyPayout, notifyAdmins } from "@/lib/lobby-payments";

const SERVICE_EMAIL = "system@goplay.lk";

let _systemUserId: string | null = null;
async function getSystemUserId(): Promise<string> {
  if (_systemUserId) return _systemUserId;
  const u = await db.user.findUnique({ where: { email: SERVICE_EMAIL }, select: { id: true } });
  if (!u) throw new Error("GoPlay system account not found — run db seed");
  _systemUserId = u.id;
  return _systemUserId;
}

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function calcHours(start: string, end: string) {
  return (toMins(end) - toMins(start)) / 60;
}

export function calcCostPerPlayer(
  hourlyRate: number,
  hours: number,
  totalSpots: number,
  groupSize: number,
  serviceFeePct: number,
) {
  const totalFacilityCost = hourlyRate * hours;
  const perPlayerBase     = totalFacilityCost / totalSpots;
  const perPlayerWithFee  = perPlayerBase * (1 + serviceFeePct / 100);
  return Math.round(perPlayerWithFee * groupSize);
}

/** What a group pays the ground by bank transfer for its spot(s). */
export function calcSpotAmount(totalCost: number, divisor: number, groupSize: number, serviceFeePct: number) {
  const perPerson = Math.round((totalCost / divisor) * (1 + serviceFeePct / 100));
  return perPerson * groupSize;
}

interface PriceableLobby {
  serviceFeePct:      number;
  preferredStartTime: string;
  preferredEndTime:   string;
  facility:           { hourlyRate: number };
  category:           { minPlayers: number };
}

/** One player's price for a lobby — what a spot charges per person. */
export function lobbyPricePerPerson(m: PriceableLobby): number {
  return calcSpotAmount(m.facility.hourlyRate * calcHours(m.preferredStartTime, m.preferredEndTime), m.category.minPlayers, 1, m.serviceFeePct);
}

/**
 * A lobby as players may see it: the price per person, never GoPlay's fee percentage —
 * how the money splits between GoPlay and the ground is admin-only.
 */
export function publicLobby<T extends PriceableLobby>(m: T): Omit<T, "serviceFeePct"> & { pricePerPerson: number } {
  const { serviceFeePct: _fee, ...rest } = m;
  return { ...rest, pricePerPerson: lobbyPricePerPerson(m) };
}

/** Lock a lobby's row for the rest of the transaction; joins, leaves, fills and expiry queue behind it. */
export async function lockLobby(tx: DbTx, matchId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "OpenMatch" WHERE id = ${matchId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

/** What a spot actually sent: confirmed money, or (for a receipt nobody checked yet) what it owed. */
export const spotMoney = (s: { paymentStatus: string; amountPaid: number; amountDue: number }) =>
  s.paymentStatus === "PAID" && s.amountPaid > 0 ? s.amountPaid : s.amountDue;

// Called after a spot payment is confirmed — books the court once enough paid spots accumulate.
// Everything happens in one transaction under the facility-day lock and the lobby's row lock, so a
// failure leaves the lobby collecting, and no join, leave or second caller can interleave.
export async function tryMatchLobby(matchId: string): Promise<void> {
  const match = await db.openMatch.findUnique({
    where:   { id: matchId },
    include: {
      facility: { select: { id: true, name: true, address: true, hourlyRate: true, owner: { select: { userId: true } } } },
      category: { select: { name: true, minPlayers: true } },
    },
  });
  if (!match || match.status !== "COLLECTING") return;

  const hours        = calcHours(match.preferredStartTime, match.preferredEndTime);
  const systemUserId = await getSystemUserId();
  const totalAmount  = match.facility.hourlyRate * hours;
  const platform     = match.payee === "PLATFORM";
  const payout       = platform ? await calcLobbyPayout(totalAmount, match.facilityId) : null;

  type Outcome =
    | { kind: "not-ready" }
    | { kind: "no-court" }
    | { kind: "matched"; bookingId: string; paidSpots: { userId: string }[] };

  const outcome = await withFacilityDayLock<Outcome>(match.facilityId, match.preferredDate, async (tx) => {
    if ((await lockLobby(tx, matchId)) !== "COLLECTING") return { kind: "not-ready" };
    // A ground suspended or taken off GoPlay can't host the game: treated like a lost court (refunds)
    if (!(await facilityTakesBookings(tx, match.facilityId))) return { kind: "no-court" };

    // Only spots whose money has been confirmed count, read under the lock
    const paidSpots = await tx.openMatchSpot.findMany({ where: { matchId, status: { in: ["RESERVED", "CONFIRMED"] }, paymentStatus: "PAID" } });
    const filled    = paidSpots.reduce((sum, s) => sum + s.groupSize, 0);
    if (filled < match.category.minPlayers) return { kind: "not-ready" };

    // The last free court is re-checked and consumed atomically, so a direct booking made at the
    // same moment can't double-book the facility. This lobby's own hold is ignored.
    const usage = await slotUsage({
      facilityId:    match.facilityId,
      date:          match.preferredDate,
      startTime:     match.preferredStartTime,
      endTime:       match.preferredEndTime,
      ignoreLobbyId: matchId,
      courtId:       match.courtId,
      client:        tx,
    });
    if (usage.courtTaken || usage.free <= 0) return { kind: "no-court" };

    const b = await tx.facilityBooking.create({
      data: {
        userId:          systemUserId,
        facilityId:      match.facilityId,
        courtId:         match.courtId,
        bookingDate:     match.preferredDate,
        startTime:       match.preferredStartTime,
        endTime:         match.preferredEndTime,
        totalHours:      hours,
        totalAmount,
        status:          "CONFIRMED",
        paymentMethod:   "ONLINE",
        paymentStatus:   "PAID",
        isOpenMatch:     true,
        openMatchId:     match.id,
        specialRequests: `GoPlay Connect — open match (${paidSpots.length} group(s))`,
      },
    });
    await tx.openMatch.update({
      where: { id: matchId },
      data:  { status: "MATCHED", totalSpotsNeeded: filled, matchBookingId: b.id, matchedAt: new Date() },
    });
    await tx.openMatchSpot.updateMany({
      where: { id: { in: paidSpots.map((s) => s.id) } },
      data:  { status: "CONFIRMED" },
    });
    // Unpaid spots lose their place now the lobby is matched
    await tx.openMatchSpot.updateMany({
      where: { matchId, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] } },
      data:  { status: "CANCELLED", cancelledAt: new Date() },
    });
    // A receipt still under review may be real money, so that spot is owed a refund — by GoPlay when
    // GoPlay collected (after an admin checks the money actually arrived), otherwise by the ground.
    const underReview = await tx.openMatchSpot.findMany({ where: { matchId, status: "RESERVED", paymentStatus: "RECEIPT_SUBMITTED" } });
    for (const sp of underReview) {
      await tx.openMatchSpot.update({
        where: { id: sp.id },
        data:  { status: "REFUNDED", cancelledAt: new Date(), ...(platform ? { refundStatus: "NEEDED", refundAmount: spotMoney(sp) } : {}) },
      });
    }
    // GoPlay now owes the ground its share of the money it actually holds
    if (payout) {
      await tx.lobbyPayout.create({
        data: {
          matchId,
          facilityId:       match.facilityId,
          collectedAmount:  paidSpots.reduce((sum, sp) => sum + spotMoney(sp), 0),
          courtAmount:      totalAmount,
          commissionRate:   payout.commissionRate,
          commissionAmount: payout.commissionAmount,
          amount:           payout.amount,
        },
      });
    }
    return { kind: "matched", bookingId: b.id, paidSpots };
  });

  if (outcome.kind === "not-ready") return;
  if (outcome.kind === "no-court") {
    await expireLobby(matchId, `The selected time slot at this facility was just booked by someone else. ${platform ? "GoPlay" : "The ground"} will refund your bank transfer.`);
    return;
  }

  if (payout) {
    const when = `${match.preferredDate.toDateString()} ${match.preferredStartTime}–${match.preferredEndTime}`;
    await notifyAdmins("Lobby payout due", `Pay ${match.facility.name} Rs. ${payout.amount.toLocaleString()} for the open match on ${when}.`);
    // The owner sees only what they'll receive — not the commission or what GoPlay kept
    await createNotification({
      userId:  match.facility.owner.userId,
      title:   "GoPlay Connect booking — payout coming",
      message: `An open match filled at ${match.facility.name} on ${when}. GoPlay will transfer Rs. ${payout.amount.toLocaleString()} to your bank account.`,
      type:    "success",
      link:    "/ground-owner/earnings",
    });
  }

  const playerIds = [...new Set(outcome.paidSpots.map((s) => s.userId))];
  const players   = await db.user.findMany({
    where:  { id: { in: playerIds } },
    select: { id: true, name: true, email: true },
  });

  await Promise.all(
    players.map((p) =>
      Promise.all([
        createNotification({
          userId:  p.id,
          title:   "Match Found! 🎉",
          message: `Your open match is confirmed at ${match.facility.name} on ${match.preferredDate.toDateString()} ${match.preferredStartTime}–${match.preferredEndTime}.`,
          type:    "success",
          link:    `/open-matches/${match.id}`,
        }),
        sendMatchFoundEmail({
          to:              p.email,
          playerName:      p.name,
          sport:           match.category.name,
          facilityName:    match.facility.name,
          facilityAddress: match.facility.address,
          date:            match.preferredDate.toDateString(),
          startTime:       match.preferredStartTime,
          endTime:         match.preferredEndTime,
          matchId:         match.id,
        }),
      ])
    )
  );

  const owner = await db.user.findUnique({
    where:  { id: match.facility.owner.userId },
    select: { email: true, name: true },
  });
  if (owner) {
    void sendNewBookingAlertEmail({
      to:            owner.email,
      ownerName:     owner.name,
      playerName:    "GoPlay Connect (Open Match)",
      facilityName:  match.facility.name,
      date:          match.preferredDate.toDateString(),
      startTime:     match.preferredStartTime,
      endTime:       match.preferredEndTime,
      totalAmount,
      paymentMethod: "ONLINE",
      bookingId:     outcome.bookingId,
    });
  }
}

export async function expireLobby(matchId: string, reason?: string): Promise<number> {
  const match = await db.openMatch.findUnique({
    where:   { id: matchId },
    include: { category: { select: { name: true } } },
  });
  if (!match || match.status !== "COLLECTING") return 0;
  const platform = match.payee === "PLATFORM";

  // Under the lobby's row lock, so a payment confirmed or a lobby filled at this moment can't interleave
  const spots = await db.$transaction(async (tx) => {
    if ((await lockLobby(tx, matchId)) !== "COLLECTING") return null;
    await tx.openMatch.update({ where: { id: matchId }, data: { status: "EXPIRED" } });
    const live = await tx.openMatchSpot.findMany({ where: { matchId, status: "RESERVED" } });

    // Anyone who transferred money (confirmed or still under review) is owed a refund — by GoPlay
    // when GoPlay collected (an admin checks receipts still under review before paying), otherwise
    // by the ground. Spots that never sent a receipt are simply cancelled.
    for (const sp of live.filter((x) => x.paymentStatus === "PAID" || x.paymentStatus === "RECEIPT_SUBMITTED")) {
      await tx.openMatchSpot.update({
        where: { id: sp.id },
        data:  { status: "REFUNDED", cancelledAt: new Date(), ...(platform ? { refundStatus: "NEEDED", refundAmount: spotMoney(sp) } : {}) },
      });
    }
    await tx.openMatchSpot.updateMany({
      where: { matchId, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] } },
      data:  { status: "CANCELLED", cancelledAt: new Date() },
    });
    return live;
  });
  if (!spots) return 0;

  const paidSpots = spots.filter((s) => s.paymentStatus === "PAID" || s.paymentStatus === "RECEIPT_SUBMITTED");
  const playerIds = [...new Set(paidSpots.map((s) => s.userId))];
  const players   = await db.user.findMany({
    where:  { id: { in: playerIds } },
    select: { id: true, name: true, email: true },
  });

  await Promise.all(
    players.map((p) =>
      Promise.all([
        createNotification({
          userId:  p.id,
          title:   "Match Not Found — Refund Due",
          message: platform
            ? `${reason ?? `Your open match lobby for ${match.category.name} could not be filled.`} GoPlay will refund your transfer — open the lobby and add the bank account to send it to.`
            : reason ?? `Your open match lobby for ${match.category.name} could not be filled. The ground will refund your bank transfer. Contact GoPlay support if it hasn't arrived within 7 days.`,
          type:    "warning",
          link:    platform ? `/open-matches/${matchId}` : `/open-matches/my-matches`,
        }),
        sendMatchExpiredEmail({
          to:         p.email,
          playerName: p.name,
          sport:      match.category.name,
          date:       match.preferredDate.toDateString(),
          startTime:  match.preferredStartTime,
          endTime:    match.preferredEndTime,
        }),
      ])
    )
  );

  if (paidSpots.length > 0 && platform) {
    const owed = paidSpots.reduce((sum, sp) => sum + spotMoney(sp), 0);
    await notifyAdmins("Lobby refunds due", `A ${match.category.name} open match on ${match.preferredDate.toDateString()} didn't go ahead. ${paidSpots.length} player(s) are owed Rs. ${owed.toLocaleString()} in total.`);
  } else if (paidSpots.length > 0) {
    const facility = await db.sportsFacility.findUnique({
      where:  { id: match.facilityId },
      select: { name: true, owner: { select: { userId: true } } },
    });
    if (facility) {
      const owed = paidSpots.reduce((sum, s) => sum + spotMoney(s), 0);
      await createNotification({
        userId:  facility.owner.userId,
        title:   "Open match cancelled — refunds due",
        message: `A ${match.category.name} open match at ${facility.name} on ${match.preferredDate.toDateString()} didn't fill. Please refund ${paidSpots.length} player(s) who transferred a total of Rs. ${owed.toLocaleString()}.`,
        type:    "warning",
        link:    "/ground-owner/bookings",
      });
    }
  }

  return paidSpots.length;
}

/**
 * Close lobbies whose time ran out without filling, so refunds are queued within minutes of anyone
 * looking rather than waiting for the daily cron. Bounded per call; expireLobby is idempotent.
 */
export async function expireOverdueLobbies(limit = 10): Promise<number> {
  const overdue = await db.openMatch.findMany({
    where:   { status: "COLLECTING", expiresAt: { lte: new Date() } },
    select:  { id: true },
    orderBy: { expiresAt: "asc" },
    take:    limit,
  });
  for (const m of overdue) await expireLobby(m.id);
  return overdue.length;
}
