import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { BookingStatus } from "@prisma/client";

const VALID_BOOKING_STATUSES = new Set<string>(Object.values(BookingStatus));

async function getWorkerFacilityId(userId: string): Promise<string | null> {
  const w = await db.facilityWorker.findUnique({ where: { userId } });
  return w?.facilityId ?? null;
}

// GET /api/worker/bookings?date=YYYY-MM-DD          (single day, used by schedule)
// GET /api/worker/bookings                           (dashboard: last 30 days, non-archived)
// GET /api/worker/bookings?history=true&from=&to=    (history page: date-range, non-archived)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_WORKER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const facilityId = await getWorkerFacilityId(session.user.id);
    if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const dateStr      = searchParams.get("date");
    const history      = searchParams.get("history") === "true";
    const from         = searchParams.get("from");
    const to           = searchParams.get("to");
    const statusRaw    = searchParams.get("status");
    const statusFilter = statusRaw && VALID_BOOKING_STATUSES.has(statusRaw) ? (statusRaw as BookingStatus) : undefined;

    let bookings;

    if (dateStr) {
      // Single-day mode (used by schedule page)
      const startOfDay = new Date(dateStr);
      const endOfDay   = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      bookings = await db.facilityBooking.findMany({
        where: { facilityId, bookingDate: { gte: startOfDay, lte: endOfDay } },
        include: { user: { select: { name: true, email: true, phone: true } }, court: { select: { name: true } } },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
      });
    } else {
      let dateFilter: { gte?: Date; lte?: Date } = {};
      if (history) {
        if (from) dateFilter.gte = new Date(from);
        if (to)   { const t = new Date(to); t.setHours(23, 59, 59, 999); dateFilter.lte = t; }
      } else {
        const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0);
        dateFilter = { gte: since };
      }
      bookings = await db.facilityBooking.findMany({
        where: {
          facilityId,
          archivedAt:  null,
          ...(statusFilter && { status: statusFilter }),
          ...(Object.keys(dateFilter).length > 0 && { bookingDate: dateFilter }),
        },
        include: { user: { select: { name: true, email: true, phone: true } }, court: { select: { name: true } } },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
      });
    }

    return Response.json({
      bookings: bookings.map((b) => ({
        id:              b.id,
        bookingDate:     b.bookingDate,
        startTime:       b.startTime,
        endTime:         b.endTime,
        status:          b.status,
        paymentMethod:   b.paymentMethod,
        paymentStatus:   b.paymentStatus,
        totalAmount:     b.totalAmount,
        playerName:      b.user.name,
        playerEmail:     b.user.email,
        playerPhone:     b.user.phone,
        contactNumber:   b.contactNumber,
        specialRequests: b.specialRequests,
        courtName:       (b as any).court?.name ?? null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/worker/bookings]", err);
    return Response.json({ error: "Failed to fetch bookings." }, { status: 500 });
  }
}

// POST /api/worker/bookings  — walk-in booking (created as CONFIRMED, cash)
export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session?.user || session.user.role !== "GROUND_WORKER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentUser = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { isActive: true },
  });
  if (!currentUser?.isActive) {
    return Response.json({ error: "Your account has been deactivated. Please contact support." }, { status: 403 });
  }

  const facilityId = await getWorkerFacilityId(session.user.id);
  if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

  const { courtId, bookingDate, startTime, endTime, playerName, contactNumber, specialRequests } =
    await req.json();

  if (!bookingDate || !startTime || !endTime || !playerName?.trim()) {
    return Response.json({ error: "bookingDate, startTime, endTime, and playerName are required." }, { status: 400 });
  }
  if ((playerName as string).trim().length < 2) {
    return Response.json({ error: "Player name must be at least 2 characters." }, { status: 400 });
  }
  if (startTime >= endTime) {
    return Response.json({ error: "End time must be after start time." }, { status: 400 });
  }
  if (contactNumber?.trim()) {
    const cleaned = (contactNumber as string).replace(/[\s\-().]/g, "");
    if (!/^(?:\+94|0)7[0-9]{8}$/.test(cleaned)) {
      return Response.json({ error: "Enter a valid Sri Lankan mobile number (e.g. 077 123 4567)." }, { status: 400 });
    }
  }
  const bookingDateObj = new Date(bookingDate);
  bookingDateObj.setUTCHours(0, 0, 0, 0);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (bookingDateObj < today) {
    return Response.json({ error: "Booking date cannot be in the past." }, { status: 400 });
  }
  const maxAdvance = new Date(); maxAdvance.setUTCHours(0, 0, 0, 0);
  maxAdvance.setDate(maxAdvance.getDate() + 60);
  if (bookingDateObj > maxAdvance) {
    return Response.json({ error: "Bookings can only be made up to 60 days in advance." }, { status: 400 });
  }

  const facility = await db.sportsFacility.findUnique({
    where:   { id: facilityId, status: "ACTIVE" },
    include: {
      owner:  { include: { user: { select: { id: true } } } },
      courts: { where: { isActive: true }, select: { id: true } },
    },
  });
  if (!facility) return Response.json({ error: "Facility not found." }, { status: 404 });

  const resolvedCourtId = courtId || null;
  if (facility.courts.length > 0 && !resolvedCourtId) {
    return Response.json({ error: "Please select a court for this walk-in booking." }, { status: 400 });
  }
  if (resolvedCourtId && !facility.courts.some((c) => c.id === resolvedCourtId)) {
    return Response.json({ error: "Selected court is not valid." }, { status: 400 });
  }

  // Check conflicts — use date range to be timezone-safe
  const startOfDay = new Date(bookingDate); startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay   = new Date(bookingDate); endOfDay.setUTCHours(23, 59, 59, 999);

  const conflict = await db.facilityBooking.findFirst({
    where: {
      facilityId,
      ...(resolvedCourtId ? { courtId: resolvedCourtId } : {}),
      bookingDate: { gte: startOfDay, lte: endOfDay },
      status:      { in: ["CONFIRMED", "PENDING"] },
      AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
    },
  });
  if (conflict) {
    return Response.json({ error: "This time slot is already booked." }, { status: 409 });
  }

  // Check blocked
  const blockedEntries = await db.blockedDate.findMany({
    where: { facilityId, date: { gte: startOfDay, lte: endOfDay } },
  });
  const fullDayBlock = blockedEntries.find((b) => !b.startTime || !b.endTime);
  if (fullDayBlock) {
    return Response.json({ error: fullDayBlock.reason ? `Blocked: ${fullDayBlock.reason}` : "This date is blocked." }, { status: 409 });
  }
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const partialBlock = blockedEntries.find(
    (b) => b.startTime && b.endTime &&
           toMins(b.startTime) < toMins(endTime) &&
           toMins(b.endTime)   > toMins(startTime)
  );
  if (partialBlock) {
    return Response.json({ error: partialBlock.reason ? `Blocked: ${partialBlock.reason}` : "This slot is blocked." }, { status: 409 });
  }

  // Calculate totals
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const totalHours  = (eh * 60 + em - (sh * 60 + sm)) / 60;
  const totalAmount = totalHours * facility.hourlyRate;

  // Walk-in bookings use a shared "walk-in" user or we create a guest entry linked to a walk-in user.
  // For simplicity, link the booking to the worker's own userId but mark as walk-in via specialRequests.
  // The worker's account is GROUND_WORKER so we use their id but store the player name.
  const booking = await db.facilityBooking.create({
    data: {
      userId:          session.user.id,
      facilityId,
      courtId:         resolvedCourtId,
      bookingDate:     bookingDateObj,
      startTime,
      endTime,
      totalHours,
      totalAmount,
      status:          "CONFIRMED",
      paymentMethod:   "ON_ARRIVAL",
      paymentStatus:   "PAID",
      contactNumber:   contactNumber  || null,
      specialRequests: `[Walk-in] ${playerName}${specialRequests ? ` — ${specialRequests}` : ""}`,
    },
  });

  // Notify owner
  await db.notification.create({
    data: {
      userId:  facility.owner.user.id,
      title:   "Walk-in Booking Added",
      message: `${session.user.name ?? "A worker"} added a walk-in booking for ${playerName} at ${facility.name} on ${bookingDate} from ${startTime} to ${endTime}.`,
      type:    "info",
    },
  });

  return Response.json({ booking }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/worker/bookings]", err);
    return Response.json({ error: "Failed to create walk-in booking." }, { status: 500 });
  }
}
