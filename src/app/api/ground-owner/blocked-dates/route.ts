import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getOwnedFacilityIds(userId: string) {
  const profile = await db.groundOwnerProfile.findUnique({
    where: { userId },
    include: { facilities: { select: { id: true } } },
  });
  return profile?.facilities.map((f) => f.id) ?? [];
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const facilityIds = await getOwnedFacilityIds(session.user.id);
    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");

    const where = facilityId
      ? { facilityId, facilityId_check: facilityIds.includes(facilityId) ? undefined : "invalid" }
      : { facilityId: { in: facilityIds } };

    if (facilityId && !facilityIds.includes(facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const blocked = await db.blockedDate.findMany({
      where: facilityId ? { facilityId } : { facilityId: { in: facilityIds } },
      include: { facility: { select: { name: true } } },
      orderBy: { date: "asc" },
    });

    return Response.json({
      blocked: blocked.map((b) => ({
        id:           b.id,
        facilityId:   b.facilityId,
        facilityName: b.facility.name,
        date:         b.date,
        startTime:    b.startTime,
        endTime:      b.endTime,
        reason:       b.reason,
      })),
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/blocked-dates]", err);
    return Response.json({ error: "Failed to fetch blocked dates." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { facilityId, date, reason, startTime, endTime } = await req.json();
    if (!facilityId || !date) {
      return Response.json({ error: "facilityId and date are required." }, { status: 400 });
    }

    // If one time is provided both must be
    if ((startTime && !endTime) || (!startTime && endTime)) {
      return Response.json({ error: "Both startTime and endTime are required for partial blocks." }, { status: 400 });
    }
    if (startTime && endTime && startTime >= endTime) {
      return Response.json({ error: "startTime must be before endTime." }, { status: 400 });
    }

    const facilityIds = await getOwnedFacilityIds(session.user.id);
    if (!facilityIds.includes(facilityId)) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const entry = await db.blockedDate.create({
      data: {
        facilityId,
        date:      new Date(date),
        startTime: startTime?.trim() || null,
        endTime:   endTime?.trim()   || null,
        reason:    reason?.trim()    || null,
      },
      include: { facility: { select: { name: true } } },
    });

    return Response.json({
      entry: {
        id:           entry.id,
        facilityId:   entry.facilityId,
        facilityName: entry.facility.name,
        date:         entry.date,
        startTime:    entry.startTime,
        endTime:      entry.endTime,
        reason:       entry.reason,
      },
    });
  } catch (err) {
    console.error("[POST /api/ground-owner/blocked-dates]", err);
    return Response.json({ error: "Failed to add blocked date." }, { status: 500 });
  }
}
