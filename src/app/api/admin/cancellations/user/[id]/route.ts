import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const [user, cancellations, noShows] = await Promise.all([
      db.user.findUnique({
        where: { id },
        select: {
          id: true, name: true, email: true, phone: true, createdAt: true,
          noShowCount: true, cashCancelCount: true,
          requiresOnlinePayment: true, isBookingSuspended: true,
        },
      }),
      db.facilityBooking.findMany({
        where:   { userId: id, status: "CANCELLED" },
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true,
          totalAmount: true, paymentMethod: true, paymentStatus: true,
          cancelledAt: true, cancelledBy: true,
          refundPercent: true, refundAmount: true,
          facility: { select: { name: true, city: true } },
        },
      }),
      db.facilityBooking.findMany({
        where:   { userId: id, status: "NO_SHOW" },
        orderBy: { noShowMarkedAt: "desc" },
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true,
          totalAmount: true, paymentMethod: true, noShowMarkedAt: true,
          facility: { select: { name: true, city: true } },
        },
      }),
    ]);

    if (!user) return Response.json({ error: "User not found." }, { status: 404 });

    return Response.json({ user, cancellations, noShows });
  } catch (err) {
    console.error("[GET /api/admin/cancellations/user/:id]", err);
    return Response.json({ error: "Failed to load user history." }, { status: 500 });
  }
}
