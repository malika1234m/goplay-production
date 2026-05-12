import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      cancellations,
      noShows,
      facilitiesWithStrikes,
      suspendedUsers,
    ] = await Promise.all([
      db.facilityBooking.findMany({
        where:   { status: "CANCELLED" },
        orderBy: { cancelledAt: "desc" },
        take:    200,
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true,
          totalAmount: true, paymentMethod: true, paymentStatus: true,
          refundStatus: true, refundAmount: true, refundPercent: true,
          cancelledAt: true, cancelledBy: true, updatedAt: true,
          user:     { select: { id: true, name: true, email: true } },
          facility: { select: { name: true, city: true } },
        },
      }),
      db.facilityBooking.findMany({
        where:   { status: "NO_SHOW" },
        orderBy: { noShowMarkedAt: "desc" },
        take:    200,
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true,
          totalAmount: true, paymentMethod: true, noShowMarkedAt: true,
          user: {
            select: {
              id: true, name: true, email: true,
              noShowCount: true, requiresOnlinePayment: true, isBookingSuspended: true,
            },
          },
          facility: { select: { name: true, city: true } },
        },
      }),
      db.sportsFacility.findMany({
        where:   { cancelStrikeCount: { gt: 0 } },
        orderBy: { cancelStrikeCount: "desc" },
        select: {
          id: true, name: true, city: true,
          cancelStrikeCount: true, strikeResetAt: true, isListingSuspended: true,
          owner: { select: { user: { select: { id: true, name: true, email: true } } } },
        },
      }),
      db.user.findMany({
        where: {
          OR: [
            { isBookingSuspended: true },
            { requiresOnlinePayment: true },
            { noShowCount: { gte: 1 } },
            { cashCancelCount: { gte: 3 } },
          ],
        },
        orderBy: { noShowCount: "desc" },
        select: {
          id: true, name: true, email: true,
          noShowCount: true, cashCancelCount: true,
          requiresOnlinePayment: true, isBookingSuspended: true,
          createdAt: true,
        },
      }),
    ]);

    const summary = {
      totalCancellations:  cancellations.length,
      cancelledByUser:     cancellations.filter((c) => c.cancelledBy === "user").length,
      cancelledByOwner:    cancellations.filter((c) => c.cancelledBy === "owner").length,
      noShowTotal:         noShows.length,
      suspendedUsers:      suspendedUsers.filter((u) => u.isBookingSuspended).length,
      restrictedUsers:     suspendedUsers.filter((u) => u.requiresOnlinePayment && !u.isBookingSuspended).length,
      facilitiesWithStrikes: facilitiesWithStrikes.length,
      suspendedListings:   facilitiesWithStrikes.filter((f) => f.isListingSuspended).length,
      refundNeeded:        cancellations.filter((c) => c.refundStatus === "NEEDED").length,
      totalRefundValue:    cancellations.filter((c) => c.refundStatus === "NEEDED")
        .reduce((s, c) => s + (c.refundAmount ?? c.totalAmount), 0),
    };

    return Response.json({ summary, cancellations, noShows, facilitiesWithStrikes, suspendedUsers });
  } catch (err) {
    console.error("[GET /api/admin/cancellations]", err);
    return Response.json({ error: "Failed to load data." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { action, facilityId, userId } = await req.json();

    if (action === "reset-strikes" && facilityId) {
      await db.sportsFacility.update({
        where: { id: facilityId },
        data:  { cancelStrikeCount: 0, strikeResetAt: new Date(), isListingSuspended: false },
      });
      return Response.json({ message: "Strikes reset and listing restored." });
    }

    if (action === "restore-listing" && facilityId) {
      await db.sportsFacility.update({
        where: { id: facilityId },
        data:  { isListingSuspended: false },
      });
      return Response.json({ message: "Listing restored." });
    }

    if (action === "unsuspend-user" && userId) {
      await db.user.update({
        where: { id: userId },
        data:  { isBookingSuspended: false, requiresOnlinePayment: false },
      });
      return Response.json({ message: "User unsuspended." });
    }

    if (action === "restrict-online-only" && userId) {
      await db.user.update({
        where: { id: userId },
        data:  { requiresOnlinePayment: true },
      });
      return Response.json({ message: "User restricted to online payments only." });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/admin/cancellations]", err);
    return Response.json({ error: "Failed to perform action." }, { status: 500 });
  }
}
