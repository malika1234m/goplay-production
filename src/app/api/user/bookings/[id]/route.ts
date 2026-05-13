import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const booking = await db.facilityBooking.findUnique({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        totalHours: true,
        totalAmount: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        facility: {
          select: { id: true, name: true, address: true, city: true },
        },
        court: { select: { name: true } },
      },
    });

    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

    return Response.json({ booking });
  } catch (err) {
    console.error("[GET /api/user/bookings/[id]]", err);
    return Response.json({ error: "Failed to fetch booking." }, { status: 500 });
  }
}
