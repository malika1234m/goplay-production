import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { reviewableFacilityIds } from "@/lib/payment-review";
import type { PaymentStatus } from "@prisma/client";

const FILTERS: Record<string, PaymentStatus[]> = {
  review:    ["RECEIPT_SUBMITTED"],
  rejected:  ["REJECTED"],
  confirmed: ["PAID"],
  all:       ["RECEIPT_SUBMITTED", "REJECTED", "PAID", "REFUNDED"],
};

// GET /api/ground-owner/payments?filter=review|rejected|confirmed|all|refunds
// Bank transfer receipts for bookings and open match spots at the caller's grounds.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const filter   = new URL(req.url).searchParams.get("filter") ?? "review";
    const statuses = FILTERS[filter] ?? FILTERS.review;
    const facilityIds = await reviewableFacilityIds(session.user);

    // Cancelled bookings whose transfer the ground still has to send back
    if (filter === "refunds") {
      const refunds = await db.facilityBooking.findMany({
        where:   { facilityId: { in: facilityIds }, refundStatus: "NEEDED" },
        orderBy: { cancelledAt: "desc" },
        take:    100,
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, refundAmount: true, refundPercent: true,
          cancelledAt: true, cancelledBy: true, receiptUrl: true, contactNumber: true,
          user: { select: { name: true, phone: true, email: true } },
          facility: { select: { name: true } },
        },
      });
      return Response.json({ refunds });
    }

    const [bookings, spots, reviewCount] = await Promise.all([
      db.facilityBooking.findMany({
        where:   { facilityId: { in: facilityIds }, paymentMethod: "ONLINE", isOpenMatch: false, receiptUrl: { not: null }, paymentStatus: { in: statuses } },
        orderBy: { receiptUploadedAt: "desc" },
        take:    100,
        select: {
          id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, status: true, paymentStatus: true,
          receiptUrl: true, receiptUploadedAt: true, receiptReviewedAt: true, receiptRejectReason: true, contactNumber: true,
          user: { select: { name: true, phone: true, email: true } },
          facility: { select: { id: true, name: true } },
          court: { select: { name: true } },
        },
      }),
      db.openMatchSpot.findMany({
        where:   { match: { facilityId: { in: facilityIds } }, receiptUrl: { not: null }, paymentStatus: { in: statuses } },
        orderBy: { receiptUploadedAt: "desc" },
        take:    100,
        select: {
          id: true, groupSize: true, amountDue: true, status: true, paymentStatus: true,
          receiptUrl: true, receiptUploadedAt: true, receiptReviewedAt: true, receiptRejectReason: true,
          user: { select: { name: true, phone: true, email: true } },
          match: { select: { id: true, preferredDate: true, preferredStartTime: true, preferredEndTime: true, category: { select: { name: true } }, facility: { select: { id: true, name: true } } } },
        },
      }),
      Promise.all([
        db.facilityBooking.count({ where: { facilityId: { in: facilityIds }, paymentStatus: "RECEIPT_SUBMITTED", isOpenMatch: false } }),
        db.openMatchSpot.count({ where: { match: { facilityId: { in: facilityIds } }, paymentStatus: "RECEIPT_SUBMITTED" } }),
      ]).then(([a, b]) => a + b),
    ]);

    const items = [
      ...bookings.map((b) => ({
        kind:                "booking" as const,
        id:                  b.id,
        playerName:          b.user.name,
        playerPhone:         b.contactNumber ?? b.user.phone,
        playerEmail:         b.user.email,
        facilityId:          b.facility.id,
        facilityName:        b.facility.name,
        label:               b.court ? `Court: ${b.court.name}` : "Booking",
        date:                b.bookingDate,
        startTime:           b.startTime,
        endTime:             b.endTime,
        amount:              b.totalAmount,
        bookingStatus:       b.status,
        paymentStatus:       b.paymentStatus,
        receiptUrl:          b.receiptUrl,
        receiptUploadedAt:   b.receiptUploadedAt,
        receiptReviewedAt:   b.receiptReviewedAt,
        receiptRejectReason: b.receiptRejectReason,
      })),
      ...spots.map((s) => ({
        kind:                "spot" as const,
        id:                  s.id,
        playerName:          s.user.name,
        playerPhone:         s.user.phone,
        playerEmail:         s.user.email,
        facilityId:          s.match.facility.id,
        facilityName:        s.match.facility.name,
        label:               `Open match · ${s.match.category.name} · ${s.groupSize} player${s.groupSize > 1 ? "s" : ""}`,
        matchId:             s.match.id,
        date:                s.match.preferredDate,
        startTime:           s.match.preferredStartTime,
        endTime:             s.match.preferredEndTime,
        amount:              s.amountDue,
        bookingStatus:       s.status,
        paymentStatus:       s.paymentStatus,
        receiptUrl:          s.receiptUrl,
        receiptUploadedAt:   s.receiptUploadedAt,
        receiptReviewedAt:   s.receiptReviewedAt,
        receiptRejectReason: s.receiptRejectReason,
      })),
    ].sort((a, b) => (b.receiptUploadedAt?.getTime() ?? 0) - (a.receiptUploadedAt?.getTime() ?? 0));

    return Response.json({ items, reviewCount });
  } catch (err) {
    console.error("[GET /api/ground-owner/payments]", err);
    return Response.json({ error: "Failed to fetch payments." }, { status: 500 });
  }
}
