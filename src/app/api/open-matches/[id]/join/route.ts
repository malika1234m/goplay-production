import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { resolveContactPhone } from "@/lib/contact-phone";
import { isAllowed } from "@/lib/rateLimiter";
import { calcHours, calcSpotAmount } from "@/lib/open-match-engine";
import { paymentDetailsSelect, resolvePaymentDetails } from "@/lib/payment-details";
import { getReceiptWindowMinutes } from "@/lib/settings";

// POST /api/open-matches/[id]/join — hold a spot; the player then transfers to the ground and uploads the receipt
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });

  // 5 joins per minute per player — mobile carriers put many players behind one shared IP, so a per-IP limit would block strangers
  if (!isAllowed(`open-match-join:${session.user.id}`, 5, 60_000)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  if (session.user.role !== "USER") {
    return Response.json({ error: "Only players can join open match lobbies." }, { status: 403 });
  }

  const { id } = await params;
  const { groupSize = 1, contactNumber } = await req.json();

  if (typeof groupSize !== "number" || groupSize < 1 || groupSize > 22) {
    return Response.json({ error: "groupSize must be between 1 and 22." }, { status: 400 });
  }

  const match = await db.openMatch.findUnique({
    where:   { id },
    include: {
      facility: { select: { name: true, address: true, city: true, capacity: true, hourlyRate: true, paymentOptions: true, ...paymentDetailsSelect } },
      category: { select: { name: true, minPlayers: true } },
      spots:    { where: { status: { in: ["RESERVED", "CONFIRMED"] } } },
    },
  });

  if (!match) return Response.json({ error: "Lobby not found." }, { status: 404 });
  if (match.status !== "COLLECTING") {
    return Response.json({ error: "This lobby is no longer accepting players." }, { status: 409 });
  }
  if (new Date() > match.expiresAt) {
    return Response.json({ error: "This lobby has expired." }, { status: 409 });
  }

  const alreadyIn = match.spots.some((s) => s.userId === session.user.id);
  if (alreadyIn) {
    return Response.json({ error: "You already have a spot in this lobby." }, { status: 409 });
  }

  const currentlyReserved = match.spots.reduce((sum, s) => sum + s.groupSize, 0);
  const facilityCapacity  = match.facility.capacity ?? match.totalSpotsNeeded * 2;
  const spotsLeft         = facilityCapacity - currentlyReserved;

  if (groupSize > spotsLeft) {
    return Response.json(
      { error: `Only ${spotsLeft} spot(s) left before the facility reaches capacity. Your group of ${groupSize} is too large.` },
      { status: 400 },
    );
  }

  const paymentDetails = resolvePaymentDetails(match.facility);
  if (!paymentDetails || match.facility.paymentOptions === "ON_ARRIVAL_ONLY") {
    return Response.json({ error: "This ground has not set up online payments yet." }, { status: 400 });
  }
  const chargeAmount = calcSpotAmount(
    match.facility.hourlyRate * calcHours(match.preferredStartTime, match.preferredEndTime),
    match.category.minPlayers, groupSize, match.serviceFeePct,
  );

  const contact = await resolveContactPhone(session.user.id, contactNumber);
  if ("error" in contact) return Response.json({ error: contact.error }, { status: 400 });

  // The checks above read outside any lock, so two taps of "Join" can both pass them.
  // Serialise joins per lobby and re-check inside the lock, holding capacity and creating
  // the spot in the same transaction so neither can happen without the other.
  const held = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('open-match-join'), hashtext(${id}))`;

    const existing = await tx.openMatchSpot.findFirst({
      where:  { matchId: id, userId: session.user.id, status: { in: ["RESERVED", "CONFIRMED"] } },
      select: { id: true },
    });
    if (existing) return { ok: false as const, error: "You already have a spot in this lobby." };

    // Hold spot capacity while payment is in progress
    const reserved = await tx.openMatch.updateMany({
      where: { id, status: "COLLECTING", spotsReserved: { lte: facilityCapacity - groupSize } },
      data:  { spotsReserved: { increment: groupSize } },
    });
    if (reserved.count === 0) {
      return { ok: false as const, error: "Sorry, the last spot(s) were just taken. Please refresh and try again." };
    }

    // Spot counts toward the lobby only once the owner confirms the transfer receipt
    const spot = await tx.openMatchSpot.create({
      data: {
        matchId:       id,
        userId:        session.user.id,
        groupSize,
        status:        "RESERVED",
        paymentStatus: "PENDING",
        amountPaid:    0,
        amountDue:     chargeAmount,
      },
    });
    return { ok: true as const, spot };
  });
  if (!held.ok) return Response.json({ error: held.error }, { status: 409 });

  return Response.json({
    spot:                 held.spot,
    chargeAmount,
    paymentDetails,
    receiptWindowMinutes: await getReceiptWindowMinutes(),
  }, { status: 201 });
}
