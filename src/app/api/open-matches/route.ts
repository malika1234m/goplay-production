import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { slotUsage, withFacilityDayLock } from "@/lib/slot-capacity";
import { getSession } from "@/lib/mobile-auth";
import { calcHours } from "@/lib/open-match-engine";
import { isAllowed, getClientIp } from "@/lib/rateLimiter";
import { buildPayHereHash, PAYHERE_MERCHANT_ID, PAYHERE_CHECKOUT_URL } from "@/lib/payhere";

const PAYHERE_FEE_PCT = 2.5;
const SERVICE_FEE_PCT = 18;

const TIME_RE = /^\d{2}:\d{2}$/;
function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
function randomCode() {
  let c = "";
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
async function uniqueLobbyCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const exists = await db.openMatch.findUnique({ where: { lobbyCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique lobby code");
}

// GET /api/open-matches — browse COLLECTING lobbies
// ?facilityId=  filter to one facility
// ?categoryId=  filter by sport
// ?city=        filter by city (derived from facility)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const facilityId = searchParams.get("facilityId")?.trim();
  const categoryId = searchParams.get("categoryId")?.trim();
  const city       = searchParams.get("city")?.trim();
  const code       = searchParams.get("code")?.trim().toUpperCase();

  const matches = await db.openMatch.findMany({
    where: {
      status:    "COLLECTING",
      expiresAt: { gt: new Date() },
      ...(facilityId ? { facilityId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(city       ? { facility: { city: { equals: city, mode: "insensitive" } } } : {}),
      ...(code       ? { lobbyCode: code } : {}),
    },
    include: {
      facility: {
        select: { id: true, name: true, address: true, city: true, hourlyRate: true, images: true },
      },
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      spots: {
        where:  { status: { in: ["RESERVED", "CONFIRMED"] } },
        select: { id: true, groupSize: true, user: { select: { id: true, name: true, avatar: true } } },
      },
    },
    orderBy: { preferredDate: "asc" },
    take: 50,
  });

  return Response.json(matches);
}

// POST /api/open-matches — create lobby at a specific facility
export async function POST(req: NextRequest) {
  if (!isAllowed(`open-match:${getClientIp(req)}`, 5, 60_000)) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
  if (session.user.role !== "USER") {
    return Response.json({ error: "Only players can create open match lobbies." }, { status: 403 });
  }

  const { facilityId, courtId, categoryId, preferredDate, preferredStartTime, preferredEndTime, groupSize = 1, totalSpotsNeeded: requestedSpots } = await req.json();

  if (!facilityId || !categoryId || !preferredDate || !preferredStartTime || !preferredEndTime) {
    return Response.json({ error: "facilityId, categoryId, preferredDate, preferredStartTime and preferredEndTime are required." }, { status: 400 });
  }
  if (!TIME_RE.test(preferredStartTime) || !TIME_RE.test(preferredEndTime)) {
    return Response.json({ error: "Times must be HH:MM format." }, { status: 400 });
  }
  if (toMins(preferredStartTime) >= toMins(preferredEndTime)) {
    return Response.json({ error: "Start time must be before end time." }, { status: 400 });
  }
  if (typeof groupSize !== "number" || groupSize < 1 || groupSize > 22) {
    return Response.json({ error: "groupSize must be between 1 and 22." }, { status: 400 });
  }

  const [facility, category] = await Promise.all([
    db.sportsFacility.findUnique({
      where: { id: facilityId, status: "ACTIVE" },
      include: { availability: true, categories: { select: { id: true } }, courts: { where: { isActive: true }, select: { id: true } } },
    }),
    db.sportsCategory.findUnique({ where: { id: categoryId } }),
  ]);

  if (!facility) return Response.json({ error: "Facility not found or not active." }, { status: 404 });
  if (!category) return Response.json({ error: "Sport category not found." }, { status: 404 });

  // A lobby books a specific court, exactly like a direct booking does
  if (facility.courts.length > 0) {
    if (!courtId) {
      return Response.json({ error: "Please select a court for the match." }, { status: 400 });
    }
    if (!facility.courts.some((c) => c.id === courtId)) {
      return Response.json({ error: "That court does not belong to this facility." }, { status: 400 });
    }
  }

  if (!category.allowOpenMatch) {
    return Response.json({ error: "Open match lobbies are not available for this sport." }, { status: 400 });
  }

  // Validate this facility supports the selected sport
  if (!facility.categories.some((c) => c.id === categoryId)) {
    return Response.json({ error: "This facility does not support the selected sport." }, { status: 400 });
  }

  // Determine lobby size — capped by facility capacity; min is always category.minPlayers
  const effectiveMax = (facility.capacity && facility.capacity > category.minPlayers)
    ? facility.capacity
    : category.minPlayers;
  const totalSpotsNeeded =
    requestedSpots !== undefined &&
    requestedSpots >= category.minPlayers &&
    requestedSpots <= effectiveMax
      ? requestedSpots
      : category.minPlayers;

  if (groupSize >= totalSpotsNeeded) {
    return Response.json(
      { error: `Your group (${groupSize}) fills the whole lobby. Just book the facility directly instead.` },
      { status: 400 },
    );
  }

  const date = new Date(preferredDate);
  date.setUTCHours(0, 0, 0, 0);
  const now = new Date(); now.setUTCHours(0, 0, 0, 0);
  if (date <= now) return Response.json({ error: "Preferred date must be in the future." }, { status: 400 });

  const maxAdvance = new Date(now); maxAdvance.setDate(maxAdvance.getDate() + 60);
  if (date > maxAdvance) return Response.json({ error: "Open matches can only be created up to 60 days ahead." }, { status: 400 });

  // Validate facility is open that day/time
  const dayOfWeek = date.getDay();
  const avail = facility.availability.find((a) => a.dayOfWeek === dayOfWeek && a.isOpen);
  if (!avail) {
    return Response.json({ error: "This facility is not open on that day." }, { status: 400 });
  }
  if (preferredStartTime < avail.openTime || preferredEndTime > avail.closeTime) {
    return Response.json({ error: `This facility is only open ${avail.openTime}–${avail.closeTime} on that day.` }, { status: 400 });
  }

  const lobbyCode = await uniqueLobbyCode();

  // Checks and the insert share one facility-day lock so two players cannot both
  // claim the last court at the same moment.
  const outcome = await withFacilityDayLock(facilityId, date, async (tx) => {

  // An exact-time duplicate for the same sport should send people to that lobby
  // rather than start a rival one beside it.
  const dupeLobby = await tx.openMatch.findFirst({
    where: {
      facilityId,
      courtId:            courtId ?? null,
      categoryId,
      preferredDate:      date,
      preferredStartTime,
      preferredEndTime,
      status:             "COLLECTING",
    },
  });
  if (dupeLobby) {
    return { ok: false as const, status: 409, body:
      { error: "A lobby already exists for this sport, facility and time slot. Join that one instead!", lobbyId: dupeLobby.id } };
  }

  // Capacity: bookings AND other lobbies hold courts, and any overlap counts —
  // not just an exact time match. Only block once every court is spoken for.
  const usage = await slotUsage({ facilityId, date, startTime: preferredStartTime, endTime: preferredEndTime, courtId, client: tx });
  if (usage.courtTaken) {
    return { ok: false as const, status: 409, body: { error: "That court is already taken for this time. Pick another court or time." } };
  }
  if (usage.free <= 0) {
    return usage.lobby
      ? { ok: false as const, status: 409, body: {
          error:   `Every court is taken then — there is already an active ${usage.lobby.categoryName} lobby for that time. Join it instead!`,
          lobbyId: usage.lobby.id,
        } }
      : { ok: false as const, status: 409, body: { error: "This time slot is already booked at this facility." } };
  }

  // Check user not already in an active lobby for this facility/date/time
  const alreadyIn = await tx.openMatchSpot.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["RESERVED", "CONFIRMED"] },
      match:  { facilityId, preferredDate: date, status: "COLLECTING" },
    },
  });
  if (alreadyIn) {
    return { ok: false as const, status: 409, body: { error: "You already have a spot at this facility on this date." } };
  }

  // Expiry: 48h before game day for small sports, 72h for large
  const expiresAt = new Date(date);
  const hoursBeforeExpiry = totalSpotsNeeded > 4 ? 72 : 48;
  expiresAt.setHours(expiresAt.getHours() - hoursBeforeExpiry);
  if (expiresAt <= new Date()) {
    return { ok: false as const, status: 400, body: { error: "It is too late to create a lobby for this date." } };
  }

  const hours = calcHours(preferredStartTime, preferredEndTime);
  if (hours < 0.5) return { ok: false as const, status: 400, body: { error: "Minimum session length is 30 minutes." } };

  const match = await tx.openMatch.create({
    data: {
      lobbyCode,
      facilityId,
      courtId:            courtId ?? null,
      categoryId,
      preferredDate:      date,
      preferredStartTime,
      preferredEndTime,
      totalSpotsNeeded,
      spotsReserved:      groupSize,
      serviceFeePct:      18,
      expiresAt,
      spots: {
        create: {
          userId:       session.user.id,
          groupSize,
          status:       "RESERVED",
          paymentStatus: "PENDING",
          amountPaid:   0,
        },
      },
    },
    include: {
      facility: { select: { id: true, name: true, address: true, city: true, hourlyRate: true } },
      court:    { select: { id: true, name: true } },
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      spots: {
        select: { id: true, groupSize: true, status: true,
                  user: { select: { id: true, name: true, avatar: true } } },
      },
    },
  });

    return { ok: true as const, match };
  });

  if (!outcome.ok) return Response.json(outcome.body, { status: outcome.status });
  const match = outcome.match;

  // Build PayHere payment params for the creator's spot
  const creatorSpot = match.spots[0];
  const orderId     = `SPOT_${creatorSpot.id}`;

  await db.openMatchSpot.update({ where: { id: creatorSpot.id }, data: { payHereOrderId: orderId } });

  const sessionHours   = calcHours(preferredStartTime, preferredEndTime);
  const totalCost      = facility.hourlyRate * sessionHours;
  const perPersonBase  = totalCost / totalSpotsNeeded;
  const perPersonFee   = Math.round(perPersonBase * (SERVICE_FEE_PCT / 100));
  const perPersonPH    = Math.round(perPersonBase * (PAYHERE_FEE_PCT / 100));
  const perPersonTotal = Math.round(perPersonBase + perPersonFee + perPersonPH);
  const chargeAmount   = Math.round(perPersonTotal * groupSize);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hash   = buildPayHereHash(orderId, chargeAmount);
  const user   = session.user;

  const payHereParams = {
    merchant_id:  PAYHERE_MERCHANT_ID,
    return_url:   `${appUrl}/open-matches/${match.id}?created=1&payment=success&spotId=${creatorSpot.id}`,
    cancel_url:   `${appUrl}/open-matches/${match.id}?created=1&payment=cancelled&spotId=${creatorSpot.id}`,
    notify_url:   `${appUrl}/api/payhere/notify`,
    order_id:     orderId,
    items:        `Open Match — ${category.name} at ${facility.name}`,
    currency:     "LKR",
    amount:       chargeAmount.toFixed(2),
    first_name:   (user.name ?? "").split(" ")[0] || "Player",
    last_name:    (user.name ?? "").split(" ").slice(1).join(" ") || "-",
    email:        user.email ?? "",
    phone:        (user as any).phone ?? "0771234567",
    address:      facility.address,
    city:         facility.city,
    country:      "Sri Lanka",
    hash,
    checkout_url: PAYHERE_CHECKOUT_URL,
  };

  return Response.json({ id: match.id, payHereParams, chargeAmount }, { status: 201 });
}
