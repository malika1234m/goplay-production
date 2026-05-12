import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getProfile(userId: string) {
  return db.groundOwnerProfile.findUnique({
    where: { userId },
    include: { facilities: { select: { id: true } } },
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");

    const profile = await getProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    // No facilityId → return list of owner's facilities
    if (!facilityId) {
      const facilities = await db.sportsFacility.findMany({
        where: { ownerId: profile.id },
        select: { id: true, name: true, city: true, status: true },
        orderBy: { name: "asc" },
      });
      return Response.json({ facilities });
    }

    // Verify ownership
    const owns = profile.facilities.some((f) => f.id === facilityId);
    if (!owns) return Response.json({ error: "Not found." }, { status: 404 });

    const schedule = await db.facilityAvailability.findMany({
      where: { facilityId },
      orderBy: { dayOfWeek: "asc" },
    });

    return Response.json({ schedule });
  } catch (err) {
    console.error("[GET /api/ground-owner/availability]", err);
    return Response.json({ error: "Failed to fetch availability." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { facilityId, schedule } = await req.json();
    if (!facilityId || !Array.isArray(schedule)) {
      return Response.json({ error: "facilityId and schedule array are required." }, { status: 400 });
    }
    if (schedule.length > 7) {
      return Response.json({ error: "Schedule cannot have more than 7 days." }, { status: 400 });
    }

    const TIME_RE = /^\d{2}:\d{2}$/;
    for (const day of schedule) {
      if (typeof day.dayOfWeek !== "number" || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        return Response.json({ error: "dayOfWeek must be between 0 (Sun) and 6 (Sat)." }, { status: 400 });
      }
      if (day.isOpen) {
        if (!TIME_RE.test(day.openTime) || !TIME_RE.test(day.closeTime)) {
          return Response.json({ error: "openTime and closeTime must be in HH:MM format." }, { status: 400 });
        }
        if (day.openTime >= day.closeTime) {
          return Response.json({ error: "closeTime must be after openTime." }, { status: 400 });
        }
      }
    }

    const profile = await getProfile(session.user.id);
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    const owns = profile.facilities.some((f) => f.id === facilityId);
    if (!owns) return Response.json({ error: "Not found." }, { status: 404 });

    // Replace entire schedule: delete existing then re-create
    await db.facilityAvailability.deleteMany({ where: { facilityId } });
    await db.facilityAvailability.createMany({
      data: schedule.map((day: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }) => ({
        facilityId,
        dayOfWeek: day.dayOfWeek,
        isOpen:    day.isOpen,
        openTime:  day.openTime  || "06:00",
        closeTime: day.closeTime || "22:00",
      })),
    });

    return Response.json({ message: "Schedule saved." });
  } catch (err) {
    console.error("[PUT /api/ground-owner/availability]", err);
    return Response.json({ error: "Failed to save availability." }, { status: 500 });
  }
}
