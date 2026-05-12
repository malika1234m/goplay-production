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

    const [facility, cancellations] = await Promise.all([
      db.sportsFacility.findUnique({
        where: { id },
        select: {
          id: true, name: true, city: true, address: true,
          cancelStrikeCount: true, strikeResetAt: true, isListingSuspended: true,
          createdAt: true,
          owner: {
            select: {
              user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
            },
          },
        },
      }),
      db.facilityBooking.findMany({
        where:   { facilityId: id, cancelledBy: { in: ["owner", "worker"] } },
        orderBy: { cancelledAt: "desc" },
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true,
          totalAmount: true, paymentMethod: true, paymentStatus: true,
          cancelledAt: true, cancelledBy: true,
          refundPercent: true, refundAmount: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    if (!facility) return Response.json({ error: "Facility not found." }, { status: 404 });

    return Response.json({ facility, cancellations });
  } catch (err) {
    console.error("[GET /api/admin/cancellations/facility/:id]", err);
    return Response.json({ error: "Failed to load facility history." }, { status: 500 });
  }
}
