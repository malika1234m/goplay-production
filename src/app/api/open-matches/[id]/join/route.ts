import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { resolveContactPhone } from "@/lib/contact-phone";
import { isAllowed } from "@/lib/rateLimiter";
import { buildPayHereHash, PAYHERE_MERCHANT_ID, PAYHERE_CHECKOUT_URL } from "@/lib/payhere";
import { calcHours } from "@/lib/open-match-engine";

const PAYHERE_FEE_PCT = 2.5;

// POST /api/open-matches/[id]/join — initiate upfront PayHere payment to reserve a spot
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
      facility: { select: { name: true, address: true, city: true, capacity: true, hourlyRate: true } },
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

    // Create spot with PENDING payment — confirmed only after PayHere webhook fires
    const created = await tx.openMatchSpot.create({
      data: {
        matchId:       id,
        userId:        session.user.id,
        groupSize,
        status:        "RESERVED",
        paymentStatus: "PENDING",
        amountPaid:    0,
      },
    });
    const spot = await tx.openMatchSpot.update({
      where: { id: created.id },
      data:  { payHereOrderId: `SPOT_${created.id}` },
    });
    return { ok: true as const, spot };
  });
  if (!held.ok) return Response.json({ error: held.error }, { status: 409 });

  const { spot } = held;
  const orderId  = spot.payHereOrderId!;

  // Calculate exact charge amount (mirrors the lobby page formula using minPlayers as divisor)
  const hours          = calcHours(match.preferredStartTime, match.preferredEndTime);
  const totalCost      = match.facility.hourlyRate * hours;
  const perPersonBase  = totalCost / match.category.minPlayers;
  const perPersonFee   = Math.round(perPersonBase * (match.serviceFeePct / 100));
  const perPersonPH    = Math.round(perPersonBase * (PAYHERE_FEE_PCT / 100));
  const perPersonTotal = Math.round(perPersonBase + perPersonFee + perPersonPH);
  const chargeAmount   = Math.round(perPersonTotal * groupSize);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hash   = buildPayHereHash(orderId, chargeAmount);
  const user   = session.user;

  const payHereParams = {
    merchant_id:  PAYHERE_MERCHANT_ID,
    return_url:   `${appUrl}/open-matches/${id}?payment=success&spotId=${spot.id}`,
    cancel_url:   `${appUrl}/open-matches/${id}?payment=cancelled&spotId=${spot.id}`,
    notify_url:   `${appUrl}/api/payhere/notify`,
    order_id:     orderId,
    items:        `Open Match — ${match.category.name} at ${match.facility.name}`,
    currency:     "LKR",
    amount:       chargeAmount.toFixed(2),
    first_name:   (user.name ?? "").split(" ")[0] || "Player",
    last_name:    (user.name ?? "").split(" ").slice(1).join(" ") || "-",
    email:        user.email ?? "",
    phone:        contact.phone,
    address:      match.facility.address,
    city:         match.facility.city,
    country:      "Sri Lanka",
    hash,
    checkout_url: PAYHERE_CHECKOUT_URL,
  };

  return Response.json({ spot, payHereParams, chargeAmount }, { status: 201 });
}
