import { db } from "@/lib/db";
import { slotUsage, withFacilityDayLock } from "@/lib/slot-capacity";
import { createNotification } from "@/lib/notify";
import { sendMatchFoundEmail, sendMatchExpiredEmail, sendNewBookingAlertEmail } from "@/lib/email";

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

// Called after a spot payment is confirmed — triggers booking when enough paid spots accumulate
export async function tryMatchLobby(matchId: string): Promise<void> {
  const match = await db.openMatch.findUnique({
    where:   { id: matchId },
    include: {
      facility: { select: { id: true, name: true, address: true, hourlyRate: true, owner: { select: { userId: true } } } },
      category: { select: { name: true, minPlayers: true } },
      // Only count spots that have actually been paid for
      spots:    { where: { status: { in: ["RESERVED", "CONFIRMED"] }, paymentStatus: "PAID" } },
    },
  });

  if (!match || match.status !== "COLLECTING") return;

  const filled = match.spots.reduce((sum, s) => sum + s.groupSize, 0);
  if (filled < match.category.minPlayers) return;

  // Atomically claim this match for processing — only ONE concurrent caller wins.
  // If another tryMatchLobby call already set status to MATCHED, count === 0 and we bail.
  const claimed = await db.openMatch.updateMany({
    where: { id: matchId, status: "COLLECTING" },
    data:  { status: "MATCHED", totalSpotsNeeded: filled },
  });
  if (claimed.count === 0) return;

  // Lobby is full — check facility slot is still free
  const hours    = calcHours(match.preferredStartTime, match.preferredEndTime);
  const systemUserId = await getSystemUserId();
  const totalAmount  = match.facility.hourlyRate * hours;

  // The last free court has to be re-checked and consumed atomically: this lobby
  // filling at the same moment as a direct booking is exactly the race that would
  // otherwise double-book the facility. Same facility-day lock as the write paths.
  const booking = await withFacilityDayLock(match.facilityId, match.preferredDate, async (tx) => {
    // Ignore this lobby's own hold, then ask whether a court is still free for it.
    const usage = await slotUsage({
      facilityId:    match.facilityId,
      date:          match.preferredDate,
      startTime:     match.preferredStartTime,
      endTime:       match.preferredEndTime,
      ignoreLobbyId: matchId,
      courtId:       match.courtId,
      client:        tx,
    });
    if (usage.courtTaken || usage.free <= 0) return null;

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
        specialRequests: `GoPlay Connect — open match (${match.spots.length} group(s))`,
      },
    });
    await tx.openMatch.update({
      where: { id: matchId },
      data:  { matchBookingId: b.id, matchedAt: new Date() },
    });
    // Confirm only spots that have been paid for
    await tx.openMatchSpot.updateMany({
      where: { matchId, status: "RESERVED", paymentStatus: "PAID" },
      data:  { status: "CONFIRMED" },
    });
    // Unpaid spots lose their place now the lobby is matched. A receipt still under review
    // may be real money, so that spot is flagged for a refund from the ground.
    await tx.openMatchSpot.updateMany({
      where: { matchId, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] } },
      data:  { status: "CANCELLED", cancelledAt: new Date() },
    });
    await tx.openMatchSpot.updateMany({
      where: { matchId, status: "RESERVED", paymentStatus: "RECEIPT_SUBMITTED" },
      data:  { status: "REFUNDED", cancelledAt: new Date() },
    });
    return b;
  });

  if (!booking) {
    // Revert status before expiring so expireLobby's own COLLECTING check passes
    await db.openMatch.update({ where: { id: matchId }, data: { status: "COLLECTING" } });
    await expireLobby(matchId, "The selected time slot at this facility was just booked by someone else. The ground will refund your bank transfer.");
    return;
  }

  const playerIds = [...new Set(match.spots.map((s) => s.userId))];
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
      bookingId:     booking.id,
    });
  }
}

export async function expireLobby(matchId: string, reason?: string): Promise<number> {
  const match = await db.openMatch.findUnique({
    where:   { id: matchId },
    include: {
      spots:    { where: { status: "RESERVED" } },
      category: { select: { name: true } },
    },
  });

  if (!match || match.status !== "COLLECTING") return 0;

  await db.openMatch.update({ where: { id: matchId }, data: { status: "EXPIRED" } });

  // Anyone who transferred money (confirmed or still under review) is owed a refund by the
  // ground; spots that never sent a receipt are simply cancelled.
  await db.openMatchSpot.updateMany({
    where: { matchId, status: "RESERVED", paymentStatus: { in: ["PAID", "RECEIPT_SUBMITTED"] } },
    data:  { status: "REFUNDED", cancelledAt: new Date() },
  });
  await db.openMatchSpot.updateMany({
    where: { matchId, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] } },
    data:  { status: "CANCELLED", cancelledAt: new Date() },
  });

  const paidSpots = match.spots.filter((s) => s.paymentStatus === "PAID" || s.paymentStatus === "RECEIPT_SUBMITTED");
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
          message: reason ?? `Your open match lobby for ${match.category.name} could not be filled. The ground will refund your bank transfer. Contact GoPlay support if it hasn't arrived within 7 days.`,
          type:    "warning",
          link:    `/open-matches/my-matches`,
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

  if (paidSpots.length > 0) {
    const facility = await db.sportsFacility.findUnique({
      where:  { id: match.facilityId },
      select: { name: true, owner: { select: { userId: true } } },
    });
    if (facility) {
      const owed = paidSpots.reduce((sum, s) => sum + s.amountDue, 0);
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
