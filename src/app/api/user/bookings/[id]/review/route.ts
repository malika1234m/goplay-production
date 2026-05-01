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
    const review = await db.facilityReview.findUnique({
      where: { bookingId: id },
      select: { id: true, rating: true, reviewText: true, createdAt: true },
    });

    return Response.json({ review });
  } catch (err) {
    console.error("[GET /api/user/bookings/[id]/review]", err);
    return Response.json({ error: "Failed." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { rating, reviewText } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }

    const booking = await db.facilityBooking.findUnique({
      where: { id },
      select: { userId: true, facilityId: true, status: true },
    });

    if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });
    if (booking.userId !== session.user.id) return Response.json({ error: "Forbidden." }, { status: 403 });
    if (booking.status !== "COMPLETED") {
      return Response.json({ error: "You can only review completed bookings." }, { status: 400 });
    }
    if (booking.specialRequests?.startsWith("[Walk-in]")) {
      return Response.json({ error: "Walk-in bookings cannot be reviewed." }, { status: 400 });
    }

    const existing = await db.facilityReview.findUnique({ where: { bookingId: id } });
    if (existing) return Response.json({ error: "You already reviewed this booking." }, { status: 409 });

    const review = await db.facilityReview.create({
      data: {
        userId:     session.user.id,
        facilityId: booking.facilityId,
        bookingId:  id,
        rating:     Number(rating),
        reviewText: reviewText?.trim() || null,
      },
    });

    return Response.json({ review }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/user/bookings/[id]/review]", err);
    return Response.json({ error: "Failed to submit review." }, { status: 500 });
  }
}
