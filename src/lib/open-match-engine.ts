import { db } from "@/lib/db";
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
  const conflict = await db.facilityBooking.findFirst({
    where: {
      facilityId:  match.facilityId,
      bookingDate: match.preferredDate,
      status:      { in: ["PENDING", "CONFIRMED"] },
      startTime:   { lt: match.preferredEndTime },
      endTime:     { gt: match.preferredStartTime },
    },
  });

  if (conflict) {
    // Revert status before expiring so expireLobby's own COLLECTING check passes
    await db.openMatch.update({ where: { id: matchId }, data: { status: "COLLECTING" } });
    await expireLobby(matchId, "The selected time slot at this facility was just booked by someone else. You have been refunded.");
    return;
  }

  const systemUserId = await getSystemUserId();
  const totalAmount  = match.facility.hourlyRate * hours;

  // Create booking + confirm spots in a single transaction — partial failure leaves no orphan
  const booking = await db.$transaction(async (tx) => {
    const b = await tx.facilityBooking.create({
      data: {
        userId:          systemUserId,
        facilityId:      match.facilityId,
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
    // Cancel any pending-payment spots — lobby is now matched, those slots are gone
    await tx.openMatchSpot.updateMany({
      where: { matchId, status: "RESERVED", paymentStatus: "PENDING" },
      data:  { status: "CANCELLED", paymentStatus: "FAILED", cancelledAt: new Date() },
    });
    return b;
  });

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

  // Paid spots get refund status; pending-payment spots (never charged) get cancelled
  await db.openMatchSpot.updateMany({
    where: { matchId, status: "RESERVED", paymentStatus: "PAID" },
    data:  { status: "REFUNDED", paymentStatus: "REFUNDED", cancelledAt: new Date() },
  });
  await db.openMatchSpot.updateMany({
    where: { matchId, status: "RESERVED", paymentStatus: "PENDING" },
    data:  { status: "CANCELLED", paymentStatus: "FAILED", cancelledAt: new Date() },
  });

  // Only notify players who actually paid — they're owed a refund
  const paidSpots = match.spots.filter((s) => s.paymentStatus === "PAID");
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
          title:   "Match Not Found — Refund Initiated",
          message: reason ?? `Your open match lobby for ${match.category.name} could not be filled. A refund will be processed to your original payment method within 5–7 business days.`,
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

  return paidSpots.length;
}
