import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";
import { tryMatchLobby } from "@/lib/open-match-engine";
import { sendBookingConfirmedEmail, sendReceiptRejectedEmail, sendReceiptSubmittedEmail } from "@/lib/email";

// "Pay online" is a bank transfer straight to the ground owner. The player uploads the
// receipt, the owner (or one of their workers) checks their account and confirms or rejects.

type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string };

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Colombo" });
const ref     = (id: string) => id.slice(0, 8).toUpperCase();

/** Facilities whose payments this user may review: every ground they own, or the one they work at. */
export async function reviewableFacilityIds(user: { id: string; role?: string | null }): Promise<string[]> {
  if (user.role === "GROUND_OWNER") {
    const facilities = await db.sportsFacility.findMany({ where: { owner: { userId: user.id } }, select: { id: true } });
    return facilities.map((f) => f.id);
  }
  if (user.role === "GROUND_WORKER") {
    const w = await db.facilityWorker.findUnique({ where: { userId: user.id }, select: { facilityId: true } });
    return w ? [w.facilityId] : [];
  }
  return [];
}

const facilityOwnerInclude = {
  select: { id: true, name: true, owner: { select: { user: { select: { id: true, name: true, email: true } } } } },
} as const;

// ── Bookings ─────────────────────────────────────────────────────────────

export async function submitBookingReceipt(bookingId: string, userId: string, receiptUrl: string): Promise<Result> {
  const booking = await db.facilityBooking.findUnique({
    where:   { id: bookingId },
    include: { facility: facilityOwnerInclude, user: { select: { name: true } } },
  });
  if (!booking || booking.userId !== userId) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.paymentMethod !== "ONLINE") return { ok: false, status: 400, error: "This booking is paid at the ground — no receipt needed." };
  if (booking.status !== "PENDING") return { ok: false, status: 409, error: "This booking is no longer waiting for payment." };
  if (!["PENDING", "REJECTED"].includes(booking.paymentStatus)) {
    return { ok: false, status: 409, error: booking.paymentStatus === "PAID" ? "This booking is already paid." : "Your receipt is already with the ground for review." };
  }

  const updated = await db.facilityBooking.updateMany({
    where: { id: bookingId, status: "PENDING", paymentStatus: { in: ["PENDING", "REJECTED"] } },
    data:  { receiptUrl, receiptUploadedAt: new Date(), paymentStatus: "RECEIPT_SUBMITTED", receiptRejectReason: null, receiptReviewedAt: null, receiptReviewedBy: null },
  });
  if (updated.count === 0) return { ok: false, status: 409, error: "This booking changed while you were uploading. Please refresh." };

  const owner = booking.facility.owner.user;
  await createNotification({
    userId:  owner.id,
    title:   "Payment receipt to review",
    message: `${booking.user.name} uploaded a bank transfer receipt of Rs. ${booking.totalAmount.toLocaleString()} for ${booking.facility.name} on ${fmtDate(booking.bookingDate)} ${booking.startTime}–${booking.endTime}.`,
    type:    "info",
    link:    "/ground-owner/bookings",
  });
  void sendReceiptSubmittedEmail({
    to: owner.email, ownerName: owner.name, playerName: booking.user.name, facilityName: booking.facility.name,
    date: fmtDate(booking.bookingDate), startTime: booking.startTime, endTime: booking.endTime,
    amount: booking.totalAmount, receiptUrl, kind: "booking", reference: ref(booking.id),
  });
  return { ok: true };
}

export async function reviewBookingPayment(opts: {
  bookingId: string;
  reviewer:  { id: string; role?: string | null };
  approve:   boolean;
  reason?:   string | null;
}): Promise<Result> {
  const facilityIds = await reviewableFacilityIds(opts.reviewer);
  const booking = await db.facilityBooking.findFirst({
    where:   { id: opts.bookingId, facilityId: { in: facilityIds } },
    include: { facility: { select: { name: true } }, user: { select: { id: true, name: true, email: true } } },
  });
  if (!booking) return { ok: false, status: 404, error: "Booking not found." };
  if (booking.paymentStatus !== "RECEIPT_SUBMITTED") return { ok: false, status: 409, error: "There is no receipt waiting for review on this booking." };

  const reason = opts.reason?.trim().slice(0, 500) || null;
  const now    = new Date();
  const updated = await db.facilityBooking.updateMany({
    where: { id: booking.id, paymentStatus: "RECEIPT_SUBMITTED" },
    data:  opts.approve
      ? { status: booking.status === "PENDING" ? "CONFIRMED" : booking.status, paymentStatus: "PAID", receiptReviewedAt: now, receiptReviewedBy: opts.reviewer.id, receiptRejectReason: null }
      : { paymentStatus: "REJECTED", receiptReviewedAt: now, receiptReviewedBy: opts.reviewer.id, receiptRejectReason: reason },
  });
  if (updated.count === 0) return { ok: false, status: 409, error: "This payment was already reviewed." };

  const when = `${fmtDate(booking.bookingDate)} ${booking.startTime}–${booking.endTime}`;
  if (opts.approve) {
    await closeComplaintsOnConfirm({ bookingId: booking.id });
    await createNotification({
      userId:  booking.user.id,
      title:   "Payment confirmed",
      message: `${booking.facility.name} confirmed your Rs. ${booking.totalAmount.toLocaleString()} transfer. Your booking on ${when} is confirmed!`,
      type:    "success",
      link:    `/my-bookings/${booking.id}/pay`,
    });
    void sendBookingConfirmedEmail({
      to: booking.user.email, name: booking.user.name, facilityName: booking.facility.name,
      date: fmtDate(booking.bookingDate), startTime: booking.startTime, endTime: booking.endTime,
      totalAmount: booking.totalAmount, paymentMethod: "ONLINE", bookingId: booking.id,
    });
  } else {
    await createNotification({
      userId:  booking.user.id,
      title:   "Payment receipt not accepted",
      message: reason
        ? `${booking.facility.name} rejected your receipt for ${when}: ${reason}`
        : `${booking.facility.name} rejected your receipt for ${when} without giving a reason. You can upload it again or raise a complaint.`,
      type:    "error",
      link:    `/my-bookings/${booking.id}/pay`,
    });
    void sendReceiptRejectedEmail({
      to: booking.user.email, name: booking.user.name, facilityName: booking.facility.name,
      date: fmtDate(booking.bookingDate), startTime: booking.startTime, endTime: booking.endTime,
      reason, link: `/my-bookings/${booking.id}/pay`,
    });
  }
  return { ok: true };
}

// ── Open match spots ─────────────────────────────────────────────────────

const spotInclude = {
  user:  { select: { id: true, name: true, email: true } },
  match: {
    select: {
      id: true, status: true, facilityId: true, preferredDate: true, preferredStartTime: true, preferredEndTime: true,
      facility: facilityOwnerInclude,
    },
  },
} as const;

export async function submitSpotReceipt(spotId: string, userId: string, receiptUrl: string): Promise<Result> {
  const spot = await db.openMatchSpot.findUnique({ where: { id: spotId }, include: spotInclude });
  if (!spot || spot.userId !== userId) return { ok: false, status: 404, error: "Spot not found." };
  if (spot.status !== "RESERVED" || spot.match.status !== "COLLECTING") return { ok: false, status: 409, error: "This spot is no longer waiting for payment." };
  if (!["PENDING", "REJECTED"].includes(spot.paymentStatus)) {
    return { ok: false, status: 409, error: spot.paymentStatus === "PAID" ? "This spot is already paid." : "Your receipt is already with the ground for review." };
  }

  const updated = await db.openMatchSpot.updateMany({
    where: { id: spotId, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] } },
    data:  { receiptUrl, receiptUploadedAt: new Date(), paymentStatus: "RECEIPT_SUBMITTED", receiptRejectReason: null, receiptReviewedAt: null, receiptReviewedBy: null },
  });
  if (updated.count === 0) return { ok: false, status: 409, error: "This spot changed while you were uploading. Please refresh." };

  const m     = spot.match;
  const owner = m.facility.owner.user;
  await createNotification({
    userId:  owner.id,
    title:   "Open match receipt to review",
    message: `${spot.user.name} uploaded a bank transfer receipt of Rs. ${spot.amountDue.toLocaleString()} for an open match spot at ${m.facility.name} on ${fmtDate(m.preferredDate)} ${m.preferredStartTime}–${m.preferredEndTime}.`,
    type:    "info",
    link:    "/ground-owner/bookings",
  });
  void sendReceiptSubmittedEmail({
    to: owner.email, ownerName: owner.name, playerName: spot.user.name, facilityName: m.facility.name,
    date: fmtDate(m.preferredDate), startTime: m.preferredStartTime, endTime: m.preferredEndTime,
    amount: spot.amountDue, receiptUrl, kind: "lobby", reference: ref(spot.id),
  });
  return { ok: true };
}

export async function reviewSpotPayment(opts: {
  spotId:   string;
  reviewer: { id: string; role?: string | null };
  approve:  boolean;
  reason?:  string | null;
}): Promise<Result> {
  const facilityIds = await reviewableFacilityIds(opts.reviewer);
  const spot = await db.openMatchSpot.findUnique({ where: { id: opts.spotId }, include: spotInclude });
  if (!spot || !facilityIds.includes(spot.match.facilityId)) return { ok: false, status: 404, error: "Spot not found." };
  if (spot.paymentStatus !== "RECEIPT_SUBMITTED") return { ok: false, status: 409, error: "There is no receipt waiting for review on this spot." };

  const reason = opts.reason?.trim().slice(0, 500) || null;
  const now    = new Date();
  const updated = await db.openMatchSpot.updateMany({
    where: { id: spot.id, paymentStatus: "RECEIPT_SUBMITTED" },
    data:  opts.approve
      ? { paymentStatus: "PAID", amountPaid: spot.amountDue, receiptReviewedAt: now, receiptReviewedBy: opts.reviewer.id, receiptRejectReason: null }
      : { paymentStatus: "REJECTED", receiptReviewedAt: now, receiptReviewedBy: opts.reviewer.id, receiptRejectReason: reason },
  });
  if (updated.count === 0) return { ok: false, status: 409, error: "This payment was already reviewed." };

  const m    = spot.match;
  const link = `/open-matches/${m.id}/pay`;
  if (opts.approve) {
    await closeComplaintsOnConfirm({ spotId: spot.id });
    await createNotification({
      userId:  spot.user.id,
      title:   "Payment confirmed — you're in the lobby!",
      message: `${m.facility.name} confirmed your Rs. ${spot.amountDue.toLocaleString()} transfer. We'll let you know when enough players join.`,
      type:    "success",
      link,
    });
    await tryMatchLobby(m.id);
  } else {
    await createNotification({
      userId:  spot.user.id,
      title:   "Payment receipt not accepted",
      message: reason
        ? `${m.facility.name} rejected your open match receipt: ${reason}`
        : `${m.facility.name} rejected your open match receipt without giving a reason. You can upload it again or raise a complaint.`,
      type:    "error",
      link,
    });
    void sendReceiptRejectedEmail({
      to: spot.user.email, name: spot.user.name, facilityName: m.facility.name,
      date: fmtDate(m.preferredDate), startTime: m.preferredStartTime, endTime: m.preferredEndTime,
      reason, link,
    });
  }
  return { ok: true };
}

// ── Complaints ───────────────────────────────────────────────────────────

/** The ground accepted the payment after all, so any dispute about it is settled. */
async function closeComplaintsOnConfirm(where: { bookingId: string } | { spotId: string }) {
  await db.paymentComplaint.updateMany({
    where: { ...where, status: "OPEN" },
    data:  { status: "RESOLVED", resolvedAt: new Date(), adminNote: "The ground confirmed the payment." },
  });
}

/** A player disputes a rejected receipt. One open complaint per booking or spot. */
export async function createPaymentComplaint(opts: {
  userId:     string;
  bookingId?: string | null;
  spotId?:    string | null;
  message:    string;
}): Promise<Result<{ complaintId: string }>> {
  const message = opts.message?.trim();
  if (!message || message.length < 10) return { ok: false, status: 400, error: "Please describe the problem in at least 10 characters." };
  if (message.length > 1000) return { ok: false, status: 400, error: "Please keep the complaint under 1000 characters." };
  if (!!opts.bookingId === !!opts.spotId) return { ok: false, status: 400, error: "Specify a booking or an open match spot." };

  let facilityId: string;
  let facilityName: string;
  if (opts.bookingId) {
    const b = await db.facilityBooking.findUnique({ where: { id: opts.bookingId }, select: { userId: true, paymentStatus: true, facility: { select: { id: true, name: true } } } });
    if (!b || b.userId !== opts.userId) return { ok: false, status: 404, error: "Booking not found." };
    if (b.paymentStatus !== "REJECTED") return { ok: false, status: 409, error: "You can only complain about a rejected receipt." };
    facilityId = b.facility.id; facilityName = b.facility.name;
  } else {
    const s = await db.openMatchSpot.findUnique({ where: { id: opts.spotId! }, select: { userId: true, paymentStatus: true, match: { select: { facility: { select: { id: true, name: true } } } } } });
    if (!s || s.userId !== opts.userId) return { ok: false, status: 404, error: "Spot not found." };
    if (s.paymentStatus !== "REJECTED") return { ok: false, status: 409, error: "You can only complain about a rejected receipt." };
    facilityId = s.match.facility.id; facilityName = s.match.facility.name;
  }

  const existing = await db.paymentComplaint.findFirst({
    where:  { status: "OPEN", ...(opts.bookingId ? { bookingId: opts.bookingId } : { spotId: opts.spotId }) },
    select: { id: true },
  });
  if (existing) return { ok: false, status: 409, error: "You already have an open complaint for this payment. The GoPlay team will be in touch." };

  const complaint = await db.paymentComplaint.create({
    data: { userId: opts.userId, facilityId, bookingId: opts.bookingId ?? null, spotId: opts.spotId ?? null, message },
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification({
    userId:  a.id,
    title:   "New payment complaint",
    message: `A player disputes a rejected receipt at ${facilityName}.`,
    type:    "warning",
    link:    "/admin/complaints",
  })));
  await createNotification({
    userId:  opts.userId,
    title:   "Complaint received",
    message: `We've received your complaint about ${facilityName}. The GoPlay team will review it and get back to you.`,
    type:    "info",
  });
  return { ok: true, complaintId: complaint.id };
}

// ── Unpaid holds ─────────────────────────────────────────────────────────

/**
 * "Pay online" bookings still holding a slot without a usable receipt: none uploaded within
 * the window, or rejected and not re-uploaded within the window. An open complaint keeps the hold.
 */
export function staleUnpaidBookingWhere(cutoff: Date) {
  return {
    status:        "PENDING" as const,
    paymentMethod: "ONLINE" as const,
    complaints:    { none: { status: "OPEN" as const } },
    OR: [
      { paymentStatus: "PENDING" as const,  createdAt:         { lt: cutoff } },
      { paymentStatus: "REJECTED" as const, receiptReviewedAt: { lt: cutoff } },
    ],
  };
}

export function staleUnpaidSpotWhere(cutoff: Date) {
  return {
    status:     "RESERVED" as const,
    match:      { status: "COLLECTING" as const },
    complaints: { none: { status: "OPEN" as const } },
    OR: [
      { paymentStatus: "PENDING" as const,  createdAt:         { lt: cutoff } },
      { paymentStatus: "REJECTED" as const, receiptReviewedAt: { lt: cutoff } },
    ],
  };
}
