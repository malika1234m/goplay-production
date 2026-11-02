import { db } from "@/lib/db";

/**
 * Active bookings a new block would cover. Blocking over them would leave players holding
 * confirmed bookings for time the ground has closed, without anyone telling them.
 */
export async function bookingsInBlock(facilityId: string, date: string, startTime?: string | null, endTime?: string | null) {
  const from = new Date(date);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setUTCHours(23, 59, 59, 999);
  return db.facilityBooking.count({
    where: {
      facilityId,
      bookingDate: { gte: from, lte: to },
      status:      { in: ["PENDING", "CONFIRMED"] },
      ...(startTime && endTime ? { AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }] } : {}),
    },
  });
}

export function blockedByBookingsMessage(count: number) {
  return `${count} booking${count === 1 ? " is" : "s are"} already in this time. Cancel ${count === 1 ? "it" : "them"} first so the player${count === 1 ? " is" : "s are"} told, then block the time.`;
}
