import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { reviewableFacilityIds } from "@/lib/payment-review";
import { paymentDetailsSelect, resolvePaymentDetails } from "@/lib/payment-details";
import { slotInstant } from "@/lib/local-time";
import { activeBookingWindow } from "@/lib/booking-window";

/** Walk-in bookings store the caller's name in the note: "[Walk-in] Name — note". */
const walkInName = (note: string) => note.replace("[Walk-in]", "").trim().split(" — ")[0].trim() || "Walk-in";

// GET /api/ground-owner/inbox?facilityId=
// Everything a ground owner (or their worker) has to act on, in one list:
// transfer receipts to check, booking requests to confirm, played sessions to close,
// refunds owed, and transfers still awaited. Uses the same rules as the full booking list
// (every PENDING booking, every CONFIRMED booking whose session has ended), so the two agree.
export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user || !["GROUND_OWNER", "GROUND_WORKER"].includes(session.user.role ?? "")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const allIds  = await reviewableFacilityIds(session.user);
    const wanted  = new URL(req.url).searchParams.get("facilityId");
    const ids     = wanted && allIds.includes(wanted) ? [wanted] : allIds;
    const today   = new Date(); today.setUTCHours(0, 0, 0, 0);

    const win      = activeBookingWindow();
    const player   = { select: { name: true, phone: true, email: true } } as const;
    const facility = { select: { id: true, name: true } } as const;
    const court    = { select: { name: true } } as const;

    const [receipts, spotReceipts, cashToConfirm, awaitingTransfer, refunds, grounds, confirmedSoFar] = await Promise.all([
      db.facilityBooking.findMany({
        where:   { facilityId: { in: ids }, paymentStatus: "RECEIPT_SUBMITTED", isOpenMatch: false, status: { in: ["PENDING", "CONFIRMED"] }, ...win },
        orderBy: { receiptUploadedAt: "asc" },
        select:  {
          id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, contactNumber: true,
          receiptUrl: true, receiptUploadedAt: true, user: player, facility, court,
        },
      }),
      db.openMatchSpot.findMany({
        where:   { paymentStatus: "RECEIPT_SUBMITTED", status: "RESERVED", match: { facilityId: { in: ids } } },
        orderBy: { receiptUploadedAt: "asc" },
        select:  {
          id: true, groupSize: true, amountDue: true, receiptUrl: true, receiptUploadedAt: true, user: player,
          match: { select: { id: true, preferredDate: true, preferredStartTime: true, preferredEndTime: true, category: { select: { name: true } }, facility, court } },
        },
      }),
      db.facilityBooking.findMany({
        where:   { facilityId: { in: ids }, status: "PENDING", paymentMethod: "ON_ARRIVAL", ...win },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
        select:  { id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, contactNumber: true, specialRequests: true, user: player, facility, court },
      }),
      db.facilityBooking.findMany({
        where:   { facilityId: { in: ids }, status: "PENDING", paymentMethod: "ONLINE", paymentStatus: { in: ["PENDING", "REJECTED"] }, ...win },
        orderBy: { createdAt: "asc" },
        select:  {
          id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, paymentStatus: true, createdAt: true,
          receiptRejectReason: true, contactNumber: true, user: player, facility, court,
          complaints: { where: { status: "OPEN" }, select: { id: true } },
        },
      }),
      db.facilityBooking.findMany({
        where:   { facilityId: { in: ids }, refundStatus: "NEEDED" },
        orderBy: { cancelledAt: "asc" },
        select:  { id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, refundAmount: true, refundPercent: true, cancelledBy: true, contactNumber: true, user: player, facility, court },
      }),
      db.sportsFacility.findMany({
        where:   { id: { in: allIds } },
        orderBy: { name: "asc" },
        select:  { id: true, name: true, status: true, ...paymentDetailsSelect },
      }),
      db.facilityBooking.findMany({
        where:   { facilityId: { in: ids }, status: "CONFIRMED", archivedAt: null, bookingDate: { gte: win.bookingDate.gte, lte: new Date(today.getTime() + 86_400_000) } },
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
        select:  {
          id: true, bookingDate: true, startTime: true, endTime: true, totalAmount: true, paymentMethod: true, paymentStatus: true,
          isOpenMatch: true, contactNumber: true, specialRequests: true, user: player, facility, court,
        },
      }),
    ]);
    const now = Date.now();
    const toClose = confirmedSoFar.filter((b) => slotInstant(b.bookingDate, b.endTime).getTime() <= now);

    const toReview = [
      ...receipts.map((b) => ({
        kind: "booking" as const, id: b.id, player: b.user.name, phone: b.contactNumber ?? b.user.phone,
        facilityId: b.facility.id, facilityName: b.facility.name, court: b.court?.name ?? null, label: null as string | null,
        date: b.bookingDate, startTime: b.startTime, endTime: b.endTime, amount: b.totalAmount,
        receiptUrl: b.receiptUrl!, receiptUploadedAt: b.receiptUploadedAt,
      })),
      ...spotReceipts.map((s) => ({
        kind: "spot" as const, id: s.id, player: s.user.name, phone: s.user.phone,
        facilityId: s.match.facility.id, facilityName: s.match.facility.name, court: s.match.court?.name ?? null,
        label: `Open match spot · ${s.match.category.name} · ${s.groupSize} player${s.groupSize > 1 ? "s" : ""}`,
        date: s.match.preferredDate, startTime: s.match.preferredStartTime, endTime: s.match.preferredEndTime, amount: s.amountDue,
        receiptUrl: s.receiptUrl!, receiptUploadedAt: s.receiptUploadedAt,
      })),
    ].sort((a, b) => (a.receiptUploadedAt?.getTime() ?? 0) - (b.receiptUploadedAt?.getTime() ?? 0));

    return Response.json({
      canEditAccounts: session.user.role === "GROUND_OWNER",
      grounds: grounds.map((g) => ({ id: g.id, name: g.name, status: g.status, account: resolvePaymentDetails(g) })),
      toReview,
      cashToConfirm: cashToConfirm.map((b) => ({
        id: b.id, type: b.specialRequests?.startsWith("[Walk-in]") ? "walkin" as const : "cash" as const, past: slotInstant(b.bookingDate, b.startTime).getTime() <= now, player: b.specialRequests?.startsWith("[Walk-in]") ? walkInName(b.specialRequests) : b.user.name, phone: b.contactNumber ?? b.user.phone,
        facilityId: b.facility.id, facilityName: b.facility.name, court: b.court?.name ?? null,
        date: b.bookingDate, startTime: b.startTime, endTime: b.endTime, amount: b.totalAmount,
      })),
      toClose: toClose.map((b) => ({
        id: b.id, cash: b.paymentMethod === "ON_ARRIVAL", openMatch: b.isOpenMatch,
        type: b.paymentMethod === "ONLINE" ? "online" as const : b.specialRequests?.startsWith("[Walk-in]") ? "walkin" as const : "cash" as const,
        player: b.isOpenMatch ? "Open match" : b.specialRequests?.startsWith("[Walk-in]") ? walkInName(b.specialRequests) : b.user.name,
        phone: b.contactNumber ?? b.user.phone,
        facilityId: b.facility.id, facilityName: b.facility.name, court: b.court?.name ?? null,
        date: b.bookingDate, startTime: b.startTime, endTime: b.endTime, amount: b.totalAmount,
      })),
      awaitingTransfer: awaitingTransfer.map((b) => ({
        id: b.id, player: b.user.name, phone: b.contactNumber ?? b.user.phone,
        facilityId: b.facility.id, facilityName: b.facility.name, court: b.court?.name ?? null,
        date: b.bookingDate, startTime: b.startTime, endTime: b.endTime, amount: b.totalAmount,
        rejected: b.paymentStatus === "REJECTED", rejectReason: b.receiptRejectReason, disputed: b.complaints.length > 0,
        bookedAt: b.createdAt,
      })),
      refunds: refunds.map((b) => ({
        id: b.id, player: b.user.name, phone: b.contactNumber ?? b.user.phone,
        facilityId: b.facility.id, facilityName: b.facility.name, court: b.court?.name ?? null,
        date: b.bookingDate, startTime: b.startTime, endTime: b.endTime,
        amount: b.refundAmount ?? b.totalAmount, percent: b.refundPercent ?? 100, cancelledBy: b.cancelledBy,
      })),
    });
  } catch (err) {
    console.error("[GET /api/ground-owner/inbox]", err);
    return Response.json({ error: "Failed to load." }, { status: 500 });
  }
}
