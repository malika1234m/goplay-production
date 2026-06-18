import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { tryMatchLobby, calcHours } from "@/lib/open-match-engine";
import { isAllowed, getClientIp } from "@/lib/rateLimiter";

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

  const session = await auth();
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
  if (session.user.role !== "USER") {
    return Response.json({ error: "Only players can create open match lobbies." }, { status: 403 });
  }

  const { facilityId, categoryId, preferredDate, preferredStartTime, preferredEndTime, groupSize = 1, totalSpotsNeeded: requestedSpots } = await req.json();

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
      include: { availability: true, categories: { select: { id: true } } },
    }),
    db.sportsCategory.findUnique({ where: { id: categoryId } }),
  ]);

  if (!facility) return Response.json({ error: "Facility not found or not active." }, { status: 404 });
  if (!category) return Response.json({ error: "Sport category not found." }, { status: 404 });

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

  // Check no existing booking conflict
  const conflict = await db.facilityBooking.findFirst({
    where: {
      facilityId,
      bookingDate: date,
      status:      { in: ["PENDING", "CONFIRMED"] },
      startTime:   { lt: preferredEndTime },
      endTime:     { gt: preferredStartTime },
    },
  });
  if (conflict) return Response.json({ error: "This time slot is already booked at this facility." }, { status: 409 });

  // Check no duplicate lobby at same facility/date/time
  const dupeLobby = await db.openMatch.findFirst({
    where: {
      facilityId,
      categoryId,
      preferredDate:      date,
      preferredStartTime,
      preferredEndTime,
      status:             "COLLECTING",
    },
  });
  if (dupeLobby) {
    return Response.json(
      { error: "A lobby already exists for this sport, facility and time slot. Join that one instead!", lobbyId: dupeLobby.id },
      { status: 409 },
    );
  }

  // Check user not already in an active lobby for this facility/date/time
  const alreadyIn = await db.openMatchSpot.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["RESERVED", "CONFIRMED"] },
      match:  { facilityId, preferredDate: date, status: "COLLECTING" },
    },
  });
  if (alreadyIn) {
    return Response.json({ error: "You already have a spot at this facility on this date." }, { status: 409 });
  }

  // Expiry: 48h before game day for small sports, 72h for large
  const expiresAt = new Date(date);
  const hoursBeforeExpiry = totalSpotsNeeded > 4 ? 72 : 48;
  expiresAt.setHours(expiresAt.getHours() - hoursBeforeExpiry);
  if (expiresAt <= new Date()) {
    return Response.json({ error: "It is too late to create a lobby for this date." }, { status: 400 });
  }

  const hours = calcHours(preferredStartTime, preferredEndTime);
  if (hours < 0.5) return Response.json({ error: "Minimum session length is 30 minutes." }, { status: 400 });

  const lobbyCode = await uniqueLobbyCode();

  const match = await db.openMatch.create({
    data: {
      lobbyCode,
      facilityId,
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
      category: { select: { id: true, name: true, icon: true, minPlayers: true } },
      spots: {
        select: { id: true, groupSize: true, status: true,
                  user: { select: { id: true, name: true, avatar: true } } },
      },
    },
  });

  tryMatchLobby(match.id).catch((err) => console.error("[open-match] tryMatchLobby failed on create:", err));

  return Response.json(match, { status: 201 });
}
