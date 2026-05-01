import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status  = searchParams.get("status");
    const history = searchParams.get("history") === "true";
    const from    = searchParams.get("from");   // YYYY-MM-DD
    const to      = searchParams.get("to");     // YYYY-MM-DD

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const facilityIds = profile.facilities.map((f) => f.id);

    // Dashboard: last 30 days, non-archived
    // History:   date-range filtered, non-archived
    let dateFilter: Record<string, unknown> = {};
    if (history) {
      if (from) dateFilter.gte = new Date(from);
      if (to)   { const t = new Date(to); t.setHours(23,59,59,999); dateFilter.lte = t; }
    } else {
      const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0,0,0,0);
      dateFilter = { gte: since };
    }

    const bookings = await db.facilityBooking.findMany({
      where: {
        facilityId:  { in: facilityIds },
        archivedAt:  null,
        ...(status && { status: status as any }),
        ...(Object.keys(dateFilter).length > 0 && { bookingDate: dateFilter }),
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        facility: { select: { name: true, city: true } },
      },
      orderBy: [{ bookingDate: "desc" }, { startTime: "asc" }],
    });

    return Response.json({ bookings });
  } catch (err) {
    console.error("[GET /api/ground-owner/bookings]", err);
    return Response.json({ error: "Failed to fetch bookings." }, { status: 500 });
  }
}

// POST — owner adds a walk-in booking
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { facilityId, bookingDate, startTime, endTime, playerName, contactNumber, notes } =
      await req.json();

    if (!facilityId || !bookingDate || !startTime || !endTime || !playerName?.trim()) {
      return Response.json(
        { error: "facilityId, bookingDate, startTime, endTime, and playerName are required." },
        { status: 400 }
      );
    }
    if (startTime >= endTime) {
      return Response.json({ error: "End time must be after start time." }, { status: 400 });
    }
    const dateObj = new Date(bookingDate);
    dateObj.setUTCHours(0, 0, 0, 0);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (dateObj < today) {
      return Response.json({ error: "Booking date cannot be in the past." }, { status: 400 });
    }

    // Verify ownership
    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 });
    if (!profile.facilities.some((f) => f.id === facilityId)) {
      return Response.json({ error: "Facility not found." }, { status: 404 });
    }

    const facility = await db.sportsFacility.findUnique({
      where: { id: facilityId, status: "ACTIVE" },
    });
    if (!facility) return Response.json({ error: "Facility is not active." }, { status: 404 });

    // Conflict check — use date range (not exact equality) to be timezone-safe
    const startOfDay = new Date(bookingDate); startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay   = new Date(bookingDate); endOfDay.setUTCHours(23, 59, 59, 999);
    const conflict = await db.facilityBooking.findFirst({
      where: {
        facilityId,
        bookingDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ["CONFIRMED", "PENDING"] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    });
    if (conflict) {
      return Response.json({ error: "This time slot is already booked." }, { status: 409 });
    }
    const blocked = await db.blockedDate.findMany({
      where: { facilityId, date: { gte: startOfDay, lte: endOfDay } },
    });
    const fullBlock = blocked.find((b) => !b.startTime || !b.endTime);
    if (fullBlock) {
      return Response.json({ error: fullBlock.reason ? `Blocked: ${fullBlock.reason}` : "This date is blocked." }, { status: 409 });
    }
    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const partialBlock = blocked.find(
      (b) => b.startTime && b.endTime &&
        toMins(b.startTime) < toMins(endTime) && toMins(b.endTime) > toMins(startTime)
    );
    if (partialBlock) {
      return Response.json({ error: partialBlock.reason ? `Blocked: ${partialBlock.reason}` : "This slot is blocked." }, { status: 409 });
    }

    // Calculate amounts
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const totalHours  = (eh * 60 + em - (sh * 60 + sm)) / 60;
    const totalAmount = totalHours * facility.hourlyRate;

    const booking = await db.facilityBooking.create({
      data: {
        userId:          session.user.id,
        facilityId,
        bookingDate:     dateObj,
        startTime,
        endTime,
        totalHours,
        totalAmount,
        status:          "CONFIRMED",
        paymentMethod:   "ON_ARRIVAL",
        paymentStatus:   "PAID",
        contactNumber:   contactNumber?.trim() || null,
        specialRequests: `[Walk-in] ${playerName.trim()}${notes?.trim() ? ` — ${notes.trim()}` : ""}`,
      },
      include: {
        user:     { select: { name: true, email: true, phone: true } },
        facility: { select: { name: true, city: true } },
      },
    });

    return Response.json({ booking }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/ground-owner/bookings]", err);
    return Response.json({ error: "Failed to create walk-in booking." }, { status: 500 });
  }
}
