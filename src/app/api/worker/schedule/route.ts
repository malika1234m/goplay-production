import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getWorkerFacilityId(userId: string): Promise<string | null> {
  const w = await db.facilityWorker.findUnique({ where: { userId } });
  return w?.facilityId ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "GROUND_WORKER") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const facilityId = await getWorkerFacilityId(session.user.id);
  if (!facilityId) return Response.json({ error: "No facility assigned." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const from     = searchParams.get("from");
  const to       = searchParams.get("to");
  const courtId  = searchParams.get("courtId") || null;
  if (!from || !to) return Response.json({ error: "from and to required." }, { status: 400 });

  const fromDate = new Date(from);
  const toDate   = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const [availability, bookings, blocked, courts] = await Promise.all([
    db.facilityAvailability.findMany({
      where: { facilityId },
      orderBy: { dayOfWeek: "asc" },
    }),
    db.facilityBooking.findMany({
      where: {
        facilityId,
        bookingDate: { gte: fromDate, lte: toDate },
        status: { notIn: ["CANCELLED"] },
        ...(courtId ? { courtId } : {}),
      },
      include: { user: { select: { name: true, email: true, phone: true } }, court: { select: { name: true } } },
      orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    }),
    db.blockedDate.findMany({
      where: { facilityId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: "asc" },
    }),
    db.facilityCourt.findMany({
      where:   { facilityId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select:  { id: true, name: true },
    }),
  ]);

  return Response.json({
    courts,
    availability: availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      isOpen:    a.isOpen,
      openTime:  a.openTime,
      closeTime: a.closeTime,
    })),
    bookings: bookings.map((b) => {
      const isPhoneBooking = b.specialRequests?.startsWith("[Walk-in]") ?? false;
      const playerName = isPhoneBooking
        ? (b.specialRequests!.replace("[Walk-in]", "").trim().split(" — ")[0].trim() || "Phone Booking")
        : (b.user.name ?? "Player");
      const walkInPhone = isPhoneBooking
        ? (b.specialRequests!.replace("[Walk-in]", "").trim().split(" — ")[1]?.trim() ?? null)
        : null;
      return {
        id:              b.id,
        bookingDate:     b.bookingDate,
        startTime:       b.startTime,
        endTime:         b.endTime,
        status:          b.status,
        playerName,
        courtName:       b.court?.name ?? null,
        courtId:         b.courtId ?? null,
        totalAmount:     b.totalAmount,
        totalHours:      b.totalHours,
        paymentMethod:   b.paymentMethod,
        paymentStatus:   b.paymentStatus,
        contactNumber:   b.contactNumber ?? null,
        specialRequests: isPhoneBooking ? null : (b.specialRequests ?? null),
        playerEmail:     b.user.email,
        playerPhone:     walkInPhone ?? b.user.phone ?? null,
        isPhoneBooking,
      };
    }),
    blocked: blocked.map((b) => ({
      id:        b.id,
      date:      b.date,
      startTime: b.startTime,
      endTime:   b.endTime,
      reason:    b.reason,
    })),
  });
}
