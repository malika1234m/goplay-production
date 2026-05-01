import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id }   = await params;
  const { note } = await req.json();

  const booking = await db.facilityBooking.findUnique({
    where: { id },
    include: {
      user:     { select: { id: true, name: true } },
      facility: {
        select: { name: true },
        include: { owner: { include: { user: { select: { id: true } } } } },
      },
    },
  });
  if (!booking) return Response.json({ error: "Booking not found." }, { status: 404 });
  if (booking.refundStatus !== "NEEDED") {
    return Response.json({ error: "This booking does not have a pending refund." }, { status: 400 });
  }

  await db.facilityBooking.update({
    where: { id },
    data: {
      refundStatus:      "PROCESSED",
      paymentStatus:     "REFUNDED",
      refundNote:        note?.trim() || null,
      refundProcessedAt: new Date(),
    },
  });

  // Notify the player
  await db.notification.create({
    data: {
      userId:  booking.user.id,
      title:   "Refund Processed",
      message: `Your refund of Rs. ${booking.totalAmount.toLocaleString()} for the cancelled booking at ${booking.facility.name} has been processed.${note ? ` Note: ${note}` : ""}`,
      type:    "success",
    },
  });

  // Notify the ground owner (for their records)
  await db.notification.create({
    data: {
      userId:  booking.facility.owner.user.id,
      title:   "Refund Issued to Player",
      message: `A refund of Rs. ${booking.totalAmount.toLocaleString()} for a cancelled booking at ${booking.facility.name} has been processed to ${booking.user.name}.`,
      type:    "info",
    },
  });

  return Response.json({ message: "Refund marked as processed." });
}
