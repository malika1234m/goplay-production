import { NextRequest } from "next/server";
import { db } from "@/lib/db";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h === 0 && m === 0 ? 1440 : h * 60 + m;
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: facilityId } = await params;
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    const courtId = searchParams.get("courtId") ?? undefined;

    if (!dateStr) {
      return Response.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
    }

    const startOfDay = new Date(dateStr);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const dayOfWeek = startOfDay.getUTCDay();

    // All 3 queries run in parallel — saves ~60-100ms vs sequential
    const [schedule, blockedEntries, bookings] = await Promise.all([
      db.facilityAvailability.findFirst({
        where: { facilityId, dayOfWeek, isOpen: true },
      }),
      db.blockedDate.findMany({
        where: {
          facilityId,
          date: { gte: startOfDay, lte: endOfDay },
          OR: [
            { courtId: null },
            ...(courtId ? [{ courtId }] : []),
          ],
        },
      }),
      db.facilityBooking.findMany({
        where: {
          facilityId,
          bookingDate: { gte: startOfDay, lte: endOfDay },
          status:      { in: ["CONFIRMED", "PENDING"] },
          ...(courtId ? { courtId } : {}),
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    if (!schedule) {
      return Response.json({ slots: [], message: "Facility is closed on this day." });
    }

    const fullDayBlock = blockedEntries.find((b) => !b.startTime || !b.endTime);
    if (fullDayBlock) {
      return Response.json({
        slots:   [],
        message: fullDayBlock.reason
          ? `This date is not available: ${fullDayBlock.reason}`
          : "This date has been blocked by the facility.",
      });
    }

    const partialBlocks = blockedEntries.filter((b) => b.startTime && b.endTime);

    // Build a Set of booked minute-ranges for O(1) slot checking
    const bookedRanges = bookings.map((b) => ({
      start: timeToMinutes(b.startTime),
      end:   timeToMinutes(b.endTime),
    }));

    const openMins  = timeToMinutes(schedule.openTime);
    const closeMins = timeToMinutes(schedule.closeTime);

    const slots: { start: string; end: string; available: boolean; blocked: boolean; blockReason?: string }[] = [];

    for (let m = openMins; m < closeMins - 59; m += 60) {
      const start = minutesToTime(m);
      const end   = minutesToTime(m + 60);

      const booked = bookedRanges.some((b) => b.start < m + 60 && b.end > m);
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
