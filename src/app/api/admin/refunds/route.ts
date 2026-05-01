import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookings = await db.facilityBooking.findMany({
    where: { status: "CANCELLED" },
    include: {
      user:     { select: { id: true, name: true, email: true, phone: true } },
      facility: {
        select: { name: true, city: true },
        include: { owner: { include: { user: { select: { name: true, email: true } } } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const online = bookings.filter((b) => b.paymentMethod === "ONLINE");
  const cash   = bookings.filter((b) => b.paymentMethod === "ON_ARRIVAL");

  const summary = {
    totalCancelled:  bookings.length,
    onlineTotal:     online.length,
    onlinePaid:      online.filter((b) => b.paymentStatus === "PAID").length,
    refundNeeded:    online.filter((b) => b.refundStatus === "NEEDED").length,
    refundProcessed: online.filter((b) => b.refundStatus === "PROCESSED").length,
    cashTotal:       cash.length,
    totalRefundValue: online
      .filter((b) => b.paymentStatus === "PAID" && b.refundStatus === "NEEDED")
      .reduce((s, b) => s + b.totalAmount, 0),
  };

  return Response.json({ summary, online, cash });
}
