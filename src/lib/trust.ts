import type { BlockReason } from "@prisma/client";
import { db } from "@/lib/db";
import { nowToSecond } from "@/lib/google-auth";
import { normalizeLkMobile } from "@/lib/phone-otp";
import { createNotification } from "@/lib/notify";
import { sendAccountBlockedEmail } from "@/lib/email";
import { CASH_CANCEL_BAN_THRESHOLD, NO_SHOW_ONLINE_THRESHOLD, NO_SHOW_SUSPEND_THRESHOLD } from "@/lib/cancellation-policy";

// Trust & safety for cash (pay-at-ground) bookings: no-show reports reviewed by GoPlay,
// and blocking people who abuse bookings — by email (and optionally phone), so a blocked
// person can't come back with a new account on the same address.

export const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  NO_SHOWS:      "Repeated no-shows",
  FAKE_BOOKINGS: "Fake or abusive bookings",
  PAYMENT_FRAUD: "Payment fraud",
  ABUSE:         "Abusive behaviour",
  OTHER:         "Breach of GoPlay's terms",
};

/** Is this email or phone on the active blocklist? */
export async function isBlocked(opts: { email?: string | null; phone?: string | null }): Promise<boolean> {
  const email = opts.email?.toLowerCase().trim();
  const phone = normalizeLkMobile(opts.phone);
  if (!email && !phone) return false;
  const hit = await db.accountBlock.findFirst({
    where:  { liftedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    select: { id: true },
  });
  return !!hit;
}

/**
 * Re-derive a player's no-show penalties from their bookings — called after an admin
 * overturns a report, so a false no-show stops counting against them.
 */
export async function recomputePenalties(userId: string) {
  const [noShows, user] = await Promise.all([
    db.facilityBooking.count({ where: { userId, status: "NO_SHOW", NOT: { noShowReview: "OVERTURNED" } } }),
    db.user.findUnique({ where: { id: userId }, select: { cashCancelCount: true } }),
  ]);
  await db.user.update({
    where: { id: userId },
    data:  {
      noShowCount:           noShows,
      requiresOnlinePayment: noShows >= NO_SHOW_ONLINE_THRESHOLD,
      isBookingSuspended:    noShows >= NO_SHOW_SUSPEND_THRESHOLD || (user?.cashCancelCount ?? 0) >= CASH_CANCEL_BAN_THRESHOLD,
    },
  });
  return noShows;
}

/**
 * Block a player: deactivate the account, sign out every device, cancel upcoming bookings that
 * hold a slot without money paid, put the email (and phone, if asked) on the blocklist, and
 * email them why. Paid upcoming bookings are left for an admin to refund and are reported back.
 */
export async function blockAccount(opts: { userId: string; reason: BlockReason; details?: string | null; blockPhone?: boolean; adminId: string }) {
  const user = await db.user.findUnique({ where: { id: opts.userId }, select: { id: true, name: true, email: true, phone: true, role: true } });
  if (!user) return { ok: false as const, status: 404, error: "User not found." };
  if (user.role !== "USER") return { ok: false as const, status: 400, error: "Only player accounts can be blocked here." };
  if (await db.accountBlock.findFirst({ where: { userId: user.id, liftedAt: null }, select: { id: true } })) {
    return { ok: false as const, status: 409, error: "This account is already blocked." };
  }

  const details  = opts.details?.trim().slice(0, 500) || null;
  const today    = new Date(); today.setUTCHours(0, 0, 0, 0);
  const upcoming = { userId: user.id, bookingDate: { gte: today }, status: { in: ["PENDING", "CONFIRMED"] as ("PENDING" | "CONFIRMED")[] } };

  const cancelled = await db.$transaction(async (tx) => {
    await tx.accountBlock.create({
      data: {
        email: user.email.toLowerCase(), phone: opts.blockPhone ? normalizeLkMobile(user.phone) : null,
        userId: user.id, reason: opts.reason, details, blockedBy: opts.adminId,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data:  { isActive: false, isBookingSuspended: true, sessionsValidAfter: nowToSecond(), pushToken: null },
    });
    // Free the slots they hold with nothing paid; paid ones need a refund, so an admin handles those
    const toCancel = await tx.facilityBooking.findMany({
      where:  { ...upcoming, OR: [{ paymentMethod: "ON_ARRIVAL" }, { paymentStatus: { in: ["PENDING", "REJECTED"] } }] },
      select: { id: true, bookingDate: true, startTime: true, facility: { select: { name: true, owner: { select: { userId: true } } } } },
    });
    if (toCancel.length) {
      await tx.facilityBooking.updateMany({
        where: { id: { in: toCancel.map((b) => b.id) } },
        data:  { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "admin" },
      });
    }
    const spots = await tx.openMatchSpot.findMany({
      where:  { userId: user.id, status: "RESERVED", paymentStatus: { in: ["PENDING", "REJECTED"] } },
      select: { id: true, matchId: true, groupSize: true },
    });
    for (const sp of spots) {
      await tx.openMatchSpot.update({ where: { id: sp.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.openMatch.updateMany({ where: { id: sp.matchId, status: "COLLECTING" }, data: { spotsReserved: { decrement: sp.groupSize } } });
    }
    return toCancel;
  });

  const paidUpcoming = await db.facilityBooking.count({ where: { ...upcoming, paymentMethod: "ONLINE", paymentStatus: { in: ["PAID", "RECEIPT_SUBMITTED"] } } });

  await Promise.all(cancelled.map((b) => createNotification({
    userId:  b.facility.owner.userId,
    title:   "Booking cancelled by GoPlay",
    message: `GoPlay cancelled ${user.name}'s booking at ${b.facility.name} on ${b.bookingDate.toDateString()} ${b.startTime}. The slot is free again.`,
    type:    "warning",
    link:    "/ground-owner/bookings",
  })));
  void sendAccountBlockedEmail({ to: user.email, name: user.name, reason: BLOCK_REASON_LABEL[opts.reason], details });

  return { ok: true as const, cancelledBookings: cancelled.length, paidUpcoming };
}

/** Lift a block. The account can sign in again; no-show restrictions stay as they are. */
export async function unblockAccount(opts: { blockId: string; adminId: string; note?: string | null }) {
  const block = await db.accountBlock.findFirst({ where: { id: opts.blockId, liftedAt: null } });
  if (!block) return { ok: false as const, status: 404, error: "No active block found." };
  await db.accountBlock.update({
    where: { id: block.id },
    data:  { liftedAt: new Date(), liftedBy: opts.adminId, liftNote: opts.note?.trim().slice(0, 500) || null },
  });
  if (block.userId) {
    const user = await db.user.findUnique({ where: { id: block.userId }, select: { cashCancelCount: true, noShowCount: true } });
    if (user) {
      await db.user.update({
        where: { id: block.userId },
        data:  {
          isActive: true,
          isBookingSuspended: user.noShowCount >= NO_SHOW_SUSPEND_THRESHOLD || user.cashCancelCount >= CASH_CANCEL_BAN_THRESHOLD,
        },
      });
    }
  }
  return { ok: true as const };
}
