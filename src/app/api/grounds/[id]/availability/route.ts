import { NextRequest } from "next/server";
import { db } from "@/lib/db";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return Response.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
    }

    const startOfDay = new Date(dateStr);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const dayOfWeek = startOfDay.getUTCDay();

    const schedule = await db.facilityAvailability.findFirst({
      where: { facilityId: id, dayOfWeek, isOpen: true },
    });

    if (!schedule) {
      return Response.json({ slots: [], message: "Facility is closed on this day." });
    }

    // Fetch all blocked entries for this date
    const blockedEntries = await db.blockedDate.findMany({
      where: { facilityId: id, date: { gte: startOfDay, lte: endOfDay } },
    });

    // Full-day block (no times set) — return immediately with no slots
    const fullDayBlock = blockedEntries.find((b) => !b.startTime || !b.endTime);
    if (fullDayBlock) {
      return Response.json({
        slots:   [],
        message: fullDayBlock.reason
          ? `This date is not available: ${fullDayBlock.reason}`
          : "This date has been blocked by the facility.",
      });
    }

    // Partial blocks — list of time ranges to mark as blocked
    const partialBlocks = blockedEntries.filter((b) => b.startTime && b.endTime);

    // Existing bookings
    const bookings = await db.facilityBooking.findMany({
      where: {
        facilityId:  id,
        bookingDate: { gte: startOfDay, lte: endOfDay },
        status:      { in: ["CONFIRMED", "PENDING"] },
      },
      select: { startTime: true, endTime: true },
    });

    // Generate hourly slots
    const openMins  = timeToMinutes(schedule.openTime);
    const closeMins = timeToMinutes(schedule.closeTime);

    const slots: { start: string; end: string; available: boolean; blocked: boolean; blockReason?: string }[] = [];

    for (let m = openMins; m < closeMins - 59; m += 60) {
      const start = minutesToTime(m);
      const end   = minutesToTime(m + 60);

      const booked = bookings.some(
        (b) => timeToMinutes(b.startTime) < m + 60 && timeToMinutes(b.endTime) > m
      );

      const blockEntry = partialBlocks.find(
        (b) => timeToMinutes(b.startTime!) < m + 60 && timeToMinutes(b.endTime!) > m
      );
      const blocked = !!blockEntry;

      slots.push({
        start,
        end,
        available:   !booked && !blocked,
        blocked,
        ...(blocked && blockEntry?.reason ? { blockReason: blockEntry.reason } : {}),
      });
    }

    return Response.json({ slots, openTime: schedule.openTime, closeTime: schedule.closeTime });
  } catch (err) {
    console.error("[GET /api/grounds/:id/availability]", err);
    return Response.json({ error: "Failed to fetch availability." }, { status: 500 });
  }
}
