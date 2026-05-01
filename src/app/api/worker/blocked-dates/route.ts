import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getWorkerFacilityId(userId: string): Promise<string | null> {
  const w = await db.facilityWorker.findUnique({ where: { userId } });
  return w?.facilityId ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "GROUND_WORKER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const facilityId = await getWorkerFacilityId(session.user.id);
  if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

  const facility = await db.sportsFacility.findUnique({
    where: { id: facilityId },
    select: { name: true },
  });

  const blocked = await db.blockedDate.findMany({
    where:   { facilityId },
    orderBy: { date: "asc" },
  });

  return Response.json({
    facilityName: facility?.name ?? "",
    blocked: blocked.map((b) => ({
      id:        b.id,
      date:      b.date,
      startTime: b.startTime,
      endTime:   b.endTime,
      reason:    b.reason,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "GROUND_WORKER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const facilityId = await getWorkerFacilityId(session.user.id);
  if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

  const { date, reason, startTime, endTime } = await req.json();
  if (!date) return Response.json({ error: "date is required." }, { status: 400 });

  if ((startTime && !endTime) || (!startTime && endTime)) {
    return Response.json({ error: "Both startTime and endTime are required for partial blocks." }, { status: 400 });
  }
  if (startTime && endTime && startTime >= endTime) {
    return Response.json({ error: "startTime must be before endTime." }, { status: 400 });
  }

  const facility = await db.sportsFacility.findUnique({
    where: { id: facilityId },
    select: {
      name: true,
      owner: { include: { user: { select: { id: true } } } },
    },
  });

  const entry = await db.blockedDate.create({
    data: {
      facilityId,
      date:      new Date(date),
      startTime: startTime?.trim() || null,
      endTime:   endTime?.trim()   || null,
      reason:    reason?.trim()    || null,
    },
  });

  // Notify owner
  if (facility) {
    await db.notification.create({
      data: {
        userId:  facility.owner.user.id,
        title:   "Slot Blocked by Worker",
        message: `${session.user.name ?? "A worker"} blocked ${startTime && endTime ? `${startTime}–${endTime}` : "the full day"} on ${date} at ${facility.name}${reason ? `: ${reason}` : ""}.`,
        type:    "info",
      },
    });
  }

  return Response.json({
    entry: {
      id:        entry.id,
      date:      entry.date,
      startTime: entry.startTime,
      endTime:   entry.endTime,
      reason:    entry.reason,
    },
  });
}
